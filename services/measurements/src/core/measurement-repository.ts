import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import type { MeasurementSubmission, MeasurementType } from './submission.js';

/**
 * Your canonical measurement shape — the read-side counterpart of your table
 * design (element 2). Replace `unknown` with the model you design; it must be
 * able to represent both measurement types.
 */
export type Measurement = unknown;

/**
 * The storage boundary of the service. The two operations mirror the API
 * perimeter; reshape these signatures if your design calls for it.
 */
export interface MeasurementRepository {
  storeSubmission(submission: MeasurementSubmission): Promise<void>;
  findByTypeAndRange(type: MeasurementType, from: Date, to: Date): Promise<Measurement[]>;
}

/**
 * This is where your table design goes to work: key construction on write,
 * query shape on read. The constructor wiring is done; the rest is yours.
 */
export class DynamoDbMeasurementRepository implements MeasurementRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async storeSubmission(_submission: MeasurementSubmission): Promise<void> {
    throw new Error('Not implemented');
  }

  async findByTypeAndRange(
    _type: MeasurementType,
    _from: Date,
    _to: Date
  ): Promise<Measurement[]> {
    throw new Error('Not implemented');
  }
}
