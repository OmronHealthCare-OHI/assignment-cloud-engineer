import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DynamoDbMeasurementRepository } from '../services/measurements/src/core/measurement-repository.js';
import { startLocalDynamoDB, type LocalDynamoDB } from './helpers/dynamodb.js';

// The repository test scaffold: an in-process DynamoDB is started for you, and
// the todos below name what we'd expect covered — implement them against your
// design. The fixtures in fixtures/ are ready-made inputs.
describe('measurement repository', () => {
  let db: LocalDynamoDB;
  let repository: DynamoDbMeasurementRepository;

  beforeAll(async () => {
    db = await startLocalDynamoDB();

    // TODO: create your table(s) here, from the same definition as
    // infrastructure/measurement-storage.tf — see test/dynamodb-harness.test.ts
    // for a working CreateTableCommand example.

    repository = new DynamoDbMeasurementRepository(db.docClient, 'measurements');
  });

  afterAll(async () => {
    await db.stop();
  });

  it('is wired to the in-process DynamoDB', () => {
    expect(repository).toBeDefined();
  });

  it.todo('stores a submission and retrieves its measurements by type and time range');
  it.todo('handles the same submission delivered twice (a retried push) according to your duplicates position');
  it.todo('handles the re-sync overlap (fixtures/app-submission-body-mass-resync.json) according to your duplicates position');
});
