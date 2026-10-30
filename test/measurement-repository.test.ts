import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DynamoDbMeasurementRepository } from '../services/measurements/src/core/measurement-repository.js';
import type { MeasurementSubmission } from '../services/measurements/src/core/submission.js';
import { measurementTableDefinition } from '../services/measurements/src/core/table-definition.js';
import { startLocalDynamoDB, type LocalDynamoDB } from './helpers/dynamodb.js';

const fixturesDir = join(process.cwd(), 'fixtures');

async function loadFixture(file: string): Promise<MeasurementSubmission> {
  return JSON.parse(await readFile(join(fixturesDir, file), 'utf-8')) as MeasurementSubmission;
}

// The repository tests run against the in-process DynamoDB, on the table shape
// from table-definition.ts (the mirror of infrastructure/measurement-storage.tf).
// Tests share one table but write to disjoint devices and query disjoint time
// windows, so they stay order-independent.
describe('measurement repository', () => {
  let db: LocalDynamoDB;
  let repository: DynamoDbMeasurementRepository;

  beforeAll(async () => {
    db = await startLocalDynamoDB();

    await db.client.send(new CreateTableCommand(measurementTableDefinition('measurements')));

    repository = new DynamoDbMeasurementRepository(db.docClient, 'measurements');
  });

  afterAll(async () => {
    await db.stop();
  });

  async function scanItemCount(): Promise<number> {
    const result = await db.docClient.send(
      new ScanCommand({ TableName: 'measurements', Select: 'COUNT' })
    );
    return result.Count ?? 0;
  }

  it('is wired to the in-process DynamoDB', () => {
    expect(repository).toBeDefined();
  });

  it('stores a submission and retrieves its measurements by type and time range', async () => {
    await repository.storeSubmission(await loadFixture('app-submission-blood-pressure.json'));

    const found = await repository.findByTypeAndRange(
      'blood_pressure',
      new Date('2026-08-25T00:00:00Z'),
      new Date('2026-08-26T00:00:00Z')
    );

    // takenAt is UTC-normalized (08:14:12+02:00 = 06:14:12Z), takenAtDevice
    // keeps the submitted string verbatim, values pass through unchanged.
    expect(found).toEqual([
      {
        type: 'blood_pressure',
        takenAt: '2026-08-25T06:14:12.000Z',
        takenAtDevice: '2026-08-25T08:14:12+02:00',
        device: { model: 'HEM-7361T', serialNumber: 'BP-4F2A-009318' },
        values: { systolic_mmhg: 128, diastolic_mmhg: 84, pulse_bpm: 71, irregular_heartbeat: false }
      },
      {
        type: 'blood_pressure',
        takenAt: '2026-08-25T19:18:03.000Z',
        takenAtDevice: '2026-08-25T21:18:03+02:00',
        device: { model: 'HEM-7361T', serialNumber: 'BP-4F2A-009318' },
        values: { systolic_mmhg: 134, diastolic_mmhg: 88, pulse_bpm: 76, irregular_heartbeat: true }
      }
    ]);
  });

  it('handles the same submission delivered twice (a retried push) according to your duplicates position', async () => {
    const submission = await loadFixture('app-submission-blood-pressure.json');

    await repository.storeSubmission(submission);
    const countAfterFirstDelivery = await scanItemCount();

    await repository.storeSubmission(submission);
    const countAfterRetry = await scanItemCount();

    // Idempotent last-write-wins: the retry rewrites the same items, so the
    // table holds no duplicates.
    expect(countAfterRetry).toBe(countAfterFirstDelivery);

    const found = await repository.findByTypeAndRange(
      'blood_pressure',
      new Date('2026-08-25T00:00:00Z'),
      new Date('2026-08-26T00:00:00Z')
    );
    expect(found.map((m) => m.takenAt)).toEqual([
      '2026-08-25T06:14:12.000Z',
      '2026-08-25T19:18:03.000Z'
    ]);
  });

  it('handles the re-sync overlap (fixtures/app-submission-body-mass-resync.json) according to your duplicates position', async () => {
    await repository.storeSubmission(await loadFixture('app-submission-body-mass.json'));
    await repository.storeSubmission(await loadFixture('app-submission-body-mass-resync.json'));

    const found = await repository.findByTypeAndRange(
      'body_mass',
      new Date('2026-08-25T00:00:00Z'),
      new Date('2026-08-27T00:00:00Z')
    );

    // The re-synced 2026-08-25 reading is stored once (same natural key), the
    // new 2026-08-26 reading is added.
    expect(found).toEqual([
      {
        type: 'body_mass',
        takenAt: '2026-08-25T07:34:35.000Z',
        takenAtDevice: '2026-08-25T07:34:35Z',
        device: { model: 'SC-330', serialNumber: 'SC330-118842' },
        values: { body_mass_g: 82400, impedance_ohm: 512 }
      },
      {
        type: 'body_mass',
        takenAt: '2026-08-26T07:41:12.000Z',
        takenAtDevice: '2026-08-26T07:41:12Z',
        device: { model: 'SC-330', serialNumber: 'SC330-118842' },
        values: { body_mass_g: 82150, impedance_ohm: 0 }
      }
    ]);
  });

  it('keeps the same serial number on different models distinct', async () => {
    const takenAt = '2026-09-01T10:00:00Z';
    const values = { body_mass_g: 70000 };

    await repository.storeSubmission({
      device: { model: 'HEM-7361T', serialNumber: 'SHARED-000001' },
      measurements: [{ type: 'body_mass', takenAt, values }]
    });
    await repository.storeSubmission({
      device: { model: 'SC-330', serialNumber: 'SHARED-000001' },
      measurements: [{ type: 'body_mass', takenAt, values }]
    });

    const found = await repository.findByTypeAndRange(
      'body_mass',
      new Date('2026-09-01T00:00:00Z'),
      new Date('2026-09-02T00:00:00Z')
    );

    // model is part of the natural key, so a cross-model serial collision
    // cannot merge or overwrite the two devices' readings.
    expect(found).toEqual([
      {
        type: 'body_mass',
        takenAt: '2026-09-01T10:00:00.000Z',
        takenAtDevice: takenAt,
        device: { model: 'HEM-7361T', serialNumber: 'SHARED-000001' },
        values
      },
      {
        type: 'body_mass',
        takenAt: '2026-09-01T10:00:00.000Z',
        takenAtDevice: takenAt,
        device: { model: 'SC-330', serialNumber: 'SHARED-000001' },
        values
      }
    ]);
  });

  it('applies [from, to) range boundaries', async () => {
    await repository.storeSubmission({
      device: { model: 'HEM-7361T', serialNumber: 'BP-BOUNDARY-000001' },
      measurements: [
        {
          type: 'blood_pressure',
          takenAt: '2026-09-10T12:00:00Z',
          values: { systolic_mmhg: 120, diastolic_mmhg: 80, pulse_bpm: 70 }
        }
      ]
    });

    const fromInclusive = await repository.findByTypeAndRange(
      'blood_pressure',
      new Date('2026-09-10T12:00:00Z'),
      new Date('2026-09-10T13:00:00Z')
    );
    expect(fromInclusive).toHaveLength(1);

    const toExclusive = await repository.findByTypeAndRange(
      'blood_pressure',
      new Date('2026-09-10T11:00:00Z'),
      new Date('2026-09-10T12:00:00Z')
    );
    expect(toExclusive).toHaveLength(0);
  });

  it('orders measurements by UTC across mixed device offsets', async () => {
    await repository.storeSubmission({
      device: { model: 'HEM-7361T', serialNumber: 'BP-OFFSET-000001' },
      measurements: [
        {
          type: 'blood_pressure',
          takenAt: '2026-09-15T10:00:00+02:00',
          values: { systolic_mmhg: 121, diastolic_mmhg: 81, pulse_bpm: 71 }
        },
        {
          type: 'blood_pressure',
          takenAt: '2026-09-15T09:30:00Z',
          values: { systolic_mmhg: 122, diastolic_mmhg: 82, pulse_bpm: 72 }
        }
      ]
    });

    const found = await repository.findByTypeAndRange(
      'blood_pressure',
      new Date('2026-09-15T00:00:00Z'),
      new Date('2026-09-16T00:00:00Z')
    );

    // 10:00+02:00 is 08:00 UTC — chronologically first despite the later
    // device-local wall time.
    expect(found.map((m) => m.takenAt)).toEqual([
      '2026-09-15T08:00:00.000Z',
      '2026-09-15T09:30:00.000Z'
    ]);
    expect(found.map((m) => m.takenAtDevice)).toEqual([
      '2026-09-15T10:00:00+02:00',
      '2026-09-15T09:30:00Z'
    ]);
  });

  it('returns an empty list for a range with no measurements', async () => {
    const found = await repository.findByTypeAndRange(
      'blood_pressure',
      new Date('2026-12-01T00:00:00Z'),
      new Date('2026-12-02T00:00:00Z')
    );

    expect(found).toEqual([]);
  });

  it('stores submissions larger than the 25-item batch-write limit', async () => {
    const measurements = Array.from({ length: 30 }, (_, minute) => ({
      type: 'body_mass' as const,
      takenAt: `2026-10-01T00:${String(minute).padStart(2, '0')}:00Z`,
      values: { body_mass_g: 70000 + minute }
    }));

    await repository.storeSubmission({
      device: { model: 'SC-330', serialNumber: 'SC330-BATCH-000001' },
      measurements
    });

    const found = await repository.findByTypeAndRange(
      'body_mass',
      new Date('2026-10-01T00:00:00Z'),
      new Date('2026-10-02T00:00:00Z')
    );

    expect(found).toHaveLength(30);
    expect(found[0]!.takenAt).toBe('2026-10-01T00:00:00.000Z');
    expect(found[29]!.takenAt).toBe('2026-10-01T00:29:00.000Z');
  });
});
