import type { AddressInfo } from 'node:net';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import dynalite from 'dynalite';

export interface LocalDynamoDB {
  /** Low-level client — use for CreateTableCommand with your table definition. */
  client: DynamoDBClient;
  /** Document client — use for Put/Get/Query with plain JS objects. */
  docClient: DynamoDBDocumentClient;
  /** Shut the in-process server down (call in afterAll). */
  stop: () => Promise<void>;
}

/**
 * Starts an in-process DynamoDB (dynalite) on a random port and returns
 * configured clients. Real CreateTable/Put/Query semantics, no Docker or AWS
 * account needed. Create your table(s) from your own definition in beforeAll —
 * see test/dynamodb-harness.test.ts for a working example.
 */
export async function startLocalDynamoDB(): Promise<LocalDynamoDB> {
  const server = dynalite({ createTableMs: 0, deleteTableMs: 0, updateTableMs: 0 });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, () => resolve());
    server.on('error', reject);
  });

  const { port } = server.address() as AddressInfo;

  const client = new DynamoDBClient({
    endpoint: `http://127.0.0.1:${port}`,
    region: 'local',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });

  return {
    client,
    docClient: DynamoDBDocumentClient.from(client),
    stop: () =>
      new Promise<void>((resolve, reject) => {
        client.destroy();
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
