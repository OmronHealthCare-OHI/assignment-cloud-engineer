import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startLocalDynamoDB, type LocalDynamoDB } from './helpers/dynamodb.js';

// Proves the in-process DynamoDB test harness works out of the box. The toy
// table below is deliberately unrelated to the assignment — your own tables,
// keys, and indexes are your design (see infrastructure/measurement-storage.tf).
describe('in-process DynamoDB harness', () => {
  let db: LocalDynamoDB;

  beforeAll(async () => {
    db = await startLocalDynamoDB();

    await db.client.send(
      new CreateTableCommand({
        TableName: 'smoke',
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      })
    );
  });

  afterAll(async () => {
    await db.stop();
  });

  it('puts and gets an item', async () => {
    await db.docClient.send(
      new PutCommand({ TableName: 'smoke', Item: { id: 'fruit-1', name: 'banana' } })
    );

    const result = await db.docClient.send(
      new GetCommand({ TableName: 'smoke', Key: { id: 'fruit-1' } })
    );

    expect(result.Item).toEqual({ id: 'fruit-1', name: 'banana' });
  });
});
