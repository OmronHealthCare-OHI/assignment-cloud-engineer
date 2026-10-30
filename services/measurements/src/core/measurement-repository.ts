import {
  BatchWriteCommand,
  QueryCommand,
  type BatchWriteCommandInput,
  type DynamoDBDocumentClient,
  type NativeAttributeValue
} from '@aws-sdk/lib-dynamodb';

import { buildPartitionKey, buildSortKey, buildTypeTimeKey, toUtcTimestamp } from './normalize.js';
import type { MeasurementSubmission, MeasurementType, SubmittedMeasurement } from './submission.js';
import { GSI_BY_TYPE_AND_TIME } from './table-definition.js';
import { validateSubmission } from './validate-submission.js';

/** Identity of the submitting device, as stored: trimmed model and serial. */
export interface MeasurementDevice {
  model: string;
  serialNumber: string;
}

/**
 * The read-side counterpart of the table design (element 2): a submitted
 * measurement normalized to UTC (`takenAt`, fixed `YYYY-MM-DDTHH:mm:ss.SSSZ`
 * format), with the original device-local timestamp preserved verbatim
 * (`takenAtDevice`) and the values passed through unchanged.
 */
export interface BloodPressureMeasurementRead {
  type: 'blood_pressure';
  takenAt: string;
  takenAtDevice: string;
  device: MeasurementDevice;
  values: {
    systolic_mmhg: number;
    diastolic_mmhg: number;
    pulse_bpm: number;
    irregular_heartbeat?: boolean;
  };
}

export interface BodyMassMeasurementRead {
  type: 'body_mass';
  takenAt: string;
  takenAtDevice: string;
  device: MeasurementDevice;
  values: {
    body_mass_g: number;
    impedance_ohm?: number;
  };
}

export type Measurement = BloodPressureMeasurementRead | BodyMassMeasurementRead;

/**
 * The stored item — the full attribute set of the table design (mirrored by
 * `infrastructure/measurement-storage.tf`). `pk`/`sk` encode the natural key
 * (model + serialNumber + takenAtUtc + type), so re-delivered submissions
 * rewrite the same item: idempotent last-write-wins, no conditionals.
 * `typeTimeKey` (`<takenAtUtc>#<model>#<serialNumber>`) ranges the GSI in UTC
 * time order.
 */
type MeasurementItem = {
  pk: string;
  sk: string;
  type: MeasurementType;
  takenAtUtc: string;
  takenAtDevice: string;
  model: string;
  serialNumber: string;
  values: BloodPressureMeasurementRead['values'] | BodyMassMeasurementRead['values'];
  typeTimeKey: string;
};

/** DynamoDB caps a single BatchWriteItem request at 25 operations. */
const BATCH_WRITE_MAX_ITEMS = 25;

/** Bounded retries for throttled (unprocessed) writes — then fail loudly. */
const BATCH_WRITE_MAX_ATTEMPTS = 3;

/**
 * The storage boundary of the service. The two operations mirror the API
 * perimeter: ingest a whole submission, retrieve a `[from, to)` time window
 * of one measurement type.
 */
export interface MeasurementRepository {
  storeSubmission(submission: MeasurementSubmission): Promise<void>;
  findByTypeAndRange(type: MeasurementType, from: Date, to: Date): Promise<Measurement[]>;
}

/**
 * This is where the table design goes to work: key construction on write,
 * query shape on read. Writes are plain puts (idempotency lives in the key
 * design); reads are a single Query shape against the `by-type-and-time` GSI.
 */
export class DynamoDbMeasurementRepository implements MeasurementRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async storeSubmission(submission: MeasurementSubmission): Promise<void> {
    const validated = validateSubmission(submission);
    const items = validated.measurements.map((measurement) =>
      toMeasurementItem(validated.device, measurement)
    );

    for (let start = 0; start < items.length; start += BATCH_WRITE_MAX_ITEMS) {
      await this.writeChunk(items.slice(start, start + BATCH_WRITE_MAX_ITEMS));
    }
  }

  async findByTypeAndRange(
    type: MeasurementType,
    from: Date,
    to: Date
  ): Promise<Measurement[]> {
    const fromKey = toUtcTimestamp(from.toISOString());
    const toKey = toUtcTimestamp(to.toISOString());
    const measurements: Measurement[] = [];
    let exclusiveStartKey: Record<string, NativeAttributeValue> | undefined;

    // One Query shape, paginated. KeyConditionExpression allows a single sort
    // key condition, so the `[from, to)` window rides on BETWEEN — inclusive
    // bounds are exact here because `typeTimeKey` is `<takenAtUtc>#<model>#
    // <serialNumber>`: an item taken exactly at `from` keys above the bare
    // timestamp (included), and one taken exactly at `to` keys above the
    // upper bound (excluded). The fixed-format UTC prefix keeps results in
    // chronological order (default scan-index-forward).
    do {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: GSI_BY_TYPE_AND_TIME,
          KeyConditionExpression: '#type = :type AND #ttk BETWEEN :from AND :to',
          ExpressionAttributeNames: { '#type': 'type', '#ttk': 'typeTimeKey' },
          ExpressionAttributeValues: { ':type': type, ':from': fromKey, ':to': toKey },
          ExclusiveStartKey: exclusiveStartKey
        })
      );
      for (const item of result.Items ?? []) {
        measurements.push(toReadModel(item as MeasurementItem));
      }
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey !== undefined);

    return measurements;
  }

  private async writeChunk(items: MeasurementItem[]): Promise<void> {
    let requestItems: NonNullable<BatchWriteCommandInput['RequestItems']> = {
      [this.tableName]: items.map((item) => ({ PutRequest: { Item: item } }))
    };

    for (let attempt = 1; ; attempt += 1) {
      const result = await this.client.send(new BatchWriteCommand({ RequestItems: requestItems }));
      const unprocessed = result.UnprocessedItems?.[this.tableName] ?? [];
      if (unprocessed.length === 0) {
        return;
      }
      if (attempt >= BATCH_WRITE_MAX_ATTEMPTS) {
        throw new Error(
          `DynamoDB left ${unprocessed.length} item(s) unprocessed after ` +
            `${BATCH_WRITE_MAX_ATTEMPTS} batch-write attempts`
        );
      }
      requestItems = { [this.tableName]: unprocessed };
    }
  }
}

function toMeasurementItem(
  device: MeasurementSubmission['device'],
  measurement: SubmittedMeasurement
): MeasurementItem {
  const model = device.model.trim();
  const serialNumber = device.serialNumber.trim();
  const takenAtUtc = toUtcTimestamp(measurement.takenAt);
  return {
    pk: buildPartitionKey(model, serialNumber),
    sk: buildSortKey(takenAtUtc, measurement.type),
    type: measurement.type,
    takenAtUtc,
    takenAtDevice: measurement.takenAt,
    model,
    serialNumber,
    values: measurement.values,
    typeTimeKey: buildTypeTimeKey(takenAtUtc, model, serialNumber)
  };
}

function toReadModel(item: MeasurementItem): Measurement {
  const base = {
    takenAt: item.takenAtUtc,
    takenAtDevice: item.takenAtDevice,
    device: { model: item.model, serialNumber: item.serialNumber }
  };
  // `values` is stored verbatim; write-side validation guarantees the
  // per-type shape, so the narrowing casts below are safe.
  return item.type === 'blood_pressure'
    ? { type: item.type, ...base, values: item.values as BloodPressureMeasurementRead['values'] }
    : { type: item.type, ...base, values: item.values as BodyMassMeasurementRead['values'] };
}
