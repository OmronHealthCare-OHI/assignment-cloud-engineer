import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2
} from 'aws-lambda';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { DynamoDbMeasurementRepository } from '../services/measurements/src/core/measurement-repository.js';
import { measurementTableDefinition } from '../services/measurements/src/core/table-definition.js';
import type { HandlerDeps } from '../services/measurements/src/entry/index.js';
import { startLocalDynamoDB, type LocalDynamoDB } from './helpers/dynamodb.js';

const tableName = 'measurements-entry';
const fixturesDir = join(process.cwd(), 'fixtures');

type MeasurementsHandler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;

let db: LocalDynamoDB;
let createHandler: (deps: HandlerDeps) => MeasurementsHandler;
let handle: MeasurementsHandler;

// The entry module wires the real DynamoDB-backed handler at import time and
// throws when TABLE_NAME is unset (loud Lambda misconfiguration) — set it
// before the dynamic import, restore it afterwards.
const originalTableName = process.env['TABLE_NAME'];

beforeAll(async () => {
  db = await startLocalDynamoDB();
  await db.client.send(new CreateTableCommand(measurementTableDefinition(tableName)));

  process.env['TABLE_NAME'] = tableName;
  ({ createHandler } = await import('../services/measurements/src/entry/index.js'));
  handle = createHandler({
    repository: new DynamoDbMeasurementRepository(db.docClient, tableName)
  });
});

afterAll(async () => {
  if (originalTableName === undefined) {
    delete process.env['TABLE_NAME'];
  } else {
    process.env['TABLE_NAME'] = originalTableName;
  }
  await db.stop();
});

async function loadFixture(file: string): Promise<string> {
  return readFile(join(fixturesDir, file), 'utf-8');
}

// The handler reads only the route (requestContext.http), the body, and the
// query parameters — the synthetic event carries just those.
function proxyEvent(
  method: string,
  options: { path?: string; body?: string; queryStringParameters?: Record<string, string> } = {}
): APIGatewayProxyEventV2 {
  const path = options.path ?? '/measurements';
  return {
    rawPath: path,
    body: options.body,
    queryStringParameters: options.queryStringParameters,
    requestContext: { http: { method, path } }
  } as APIGatewayProxyEventV2;
}

/** Asserts the full transport contract: status, JSON content type, exact body. */
function expectJsonResponse(
  result: APIGatewayProxyResultV2,
  statusCode: number,
  body: unknown
): void {
  expect(result).toEqual({
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function parsedBody(result: APIGatewayProxyResultV2): Record<string, unknown> {
  return JSON.parse((result as APIGatewayProxyStructuredResultV2).body ?? '') as Record<
    string,
    unknown
  >;
}

/** For the GET 400s the brief fixes the status; the message is the handler's. */
function expectJsonErrorWithMessage(result: APIGatewayProxyResultV2, statusCode: number): void {
  expect(result).toMatchObject({
    statusCode,
    headers: { 'content-type': 'application/json' }
  });
  expect(parsedBody(result)['error']).toBeTypeOf('string');
}

describe('entry handler', () => {
  it('accepts a submission with 202 and serves it back by type and range with 200', async () => {
    const submission = await loadFixture('app-submission-blood-pressure.json');

    expectJsonResponse(await handle(proxyEvent('POST', { body: submission })), 202, {
      status: 'accepted'
    });

    expectJsonResponse(
      await handle(
        proxyEvent('GET', {
          queryStringParameters: {
            type: 'blood_pressure',
            from: '2026-08-25T00:00:00Z',
            to: '2026-08-26T00:00:00Z'
          }
        })
      ),
      200,
      [
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
      ]
    );
  });

  it('rejects a malformed JSON body with 400', async () => {
    expectJsonResponse(await handle(proxyEvent('POST', { body: '{"device": ' })), 400, {
      error: 'invalid JSON body'
    });
  });

  it('rejects an invalid submission with 400 carrying the validation message', async () => {
    const body = JSON.stringify({
      device: { model: 'HEM-7361T', serialNumber: 'BP-4F2A-009318' },
      measurements: []
    });

    expectJsonResponse(await handle(proxyEvent('POST', { body })), 400, {
      error: 'measurements must contain at least one measurement'
    });
  });

  it('accepts a re-delivered submission and keeps it stored once (duplicates position)', async () => {
    const submission = await loadFixture('app-submission-blood-pressure.json');

    expectJsonResponse(await handle(proxyEvent('POST', { body: submission })), 202, {
      status: 'accepted'
    });

    const result = await handle(
      proxyEvent('GET', {
        queryStringParameters: {
          type: 'blood_pressure',
          from: '2026-08-25T00:00:00Z',
          to: '2026-08-26T00:00:00Z'
        }
      })
    );

    expect(parsedBody(result)).toHaveLength(2);
  });

  it('rejects a GET missing the to parameter with 400', async () => {
    const result = await handle(
      proxyEvent('GET', {
        queryStringParameters: { type: 'blood_pressure', from: '2026-08-25T00:00:00Z' }
      })
    );

    expectJsonErrorWithMessage(result, 400);
  });

  it('rejects an unknown measurement type with 400', async () => {
    const result = await handle(
      proxyEvent('GET', {
        queryStringParameters: {
          type: 'heart_rate',
          from: '2026-08-25T00:00:00Z',
          to: '2026-08-26T00:00:00Z'
        }
      })
    );

    expectJsonErrorWithMessage(result, 400);
  });

  it('rejects from >= to with 400', async () => {
    const result = await handle(
      proxyEvent('GET', {
        queryStringParameters: {
          type: 'blood_pressure',
          from: '2026-08-26T00:00:00Z',
          to: '2026-08-26T00:00:00Z'
        }
      })
    );

    expectJsonErrorWithMessage(result, 400);
  });

  it('rejects an unparseable from with 400', async () => {
    const result = await handle(
      proxyEvent('GET', {
        queryStringParameters: {
          type: 'blood_pressure',
          from: 'yesterday',
          to: '2026-08-26T00:00:00Z'
        }
      })
    );

    expectJsonErrorWithMessage(result, 400);
  });

  it('answers 404 for an unknown route', async () => {
    const submission = await loadFixture('app-submission-blood-pressure.json');

    expectJsonResponse(await handle(proxyEvent('POST', { path: '/unknown', body: submission })), 404, {
      error: 'not found'
    });
  });

  it('answers 404 for an unsupported method', async () => {
    const submission = await loadFixture('app-submission-blood-pressure.json');

    expectJsonResponse(await handle(proxyEvent('PUT', { body: submission })), 404, {
      error: 'not found'
    });
  });

  it('answers 500 without leaking internals when the repository fails', async () => {
    // The handler logs the real cause server-side; capture it so the test
    // output stays clean while the logging behavior stays covered.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const failingHandler = createHandler({
      repository: {
        storeSubmission: async () => {
          throw new Error('connection reset by peer');
        },
        findByTypeAndRange: async () => {
          throw new Error('connection reset by peer');
        }
      }
    });

    const submission = await loadFixture('app-submission-blood-pressure.json');
    const result = await failingHandler(proxyEvent('POST', { body: submission }));

    expectJsonResponse(result, 500, { error: 'internal error' });
    expect((result as APIGatewayProxyStructuredResultV2).body).not.toContain('connection reset');
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
  });
});
