// The compute adapter: a single Lambda behind an API Gateway HTTP API, doing
// method dispatch. Thin by design — it translates transport in/out and calls
// core; all domain rules live in ../core/.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

import type { MeasurementType } from '../core/index.js';
import { ValidationError, validateSubmission } from '../core/index.js';
import {
  DynamoDbMeasurementRepository,
  type MeasurementRepository
} from '../core/measurement-repository.js';

export interface HandlerDeps {
  repository: MeasurementRepository;
}

const MEASUREMENTS_PATH = '/measurements';

/**
 * Builds the Lambda handler around injected dependencies — tests wire the
 * harness-backed repository; the exported `handler` wires the real one.
 */
export function createHandler(
  deps: HandlerDeps
): (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2> {
  return async (event) => {
    try {
      const { method, path } = event.requestContext.http;
      if (isMeasurementsPath(path)) {
        if (method === 'POST') {
          return await handlePost(event, deps.repository);
        }
        if (method === 'GET') {
          return await handleGet(event, deps.repository);
        }
      }
      return jsonResponse(404, { error: 'not found' });
    } catch (error) {
      if (error instanceof ValidationError) {
        return jsonResponse(400, { error: error.message });
      }
      // Details go to the logs; the response never leaks internals.
      console.error('Unhandled error in measurements handler', error);
      return jsonResponse(500, { error: 'internal error' });
    }
  };
}

// With a deployment stage the runtime path is prefixed (`/dev/measurements`),
// so the route matches on the suffix.
function isMeasurementsPath(path: string): boolean {
  return path.endsWith(MEASUREMENTS_PATH);
}

async function handlePost(
  event: APIGatewayProxyEventV2,
  repository: MeasurementRepository
): Promise<APIGatewayProxyResultV2> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(event.body ?? '');
  } catch {
    return jsonResponse(400, { error: 'invalid JSON body' });
  }
  // validateSubmission throws ValidationError for contract violations; the
  // dispatch catch maps it to 400.
  const submission = validateSubmission(parsed);
  await repository.storeSubmission(submission);
  return jsonResponse(202, { status: 'accepted' });
}

async function handleGet(
  event: APIGatewayProxyEventV2,
  repository: MeasurementRepository
): Promise<APIGatewayProxyResultV2> {
  const { type, from, to } = event.queryStringParameters ?? {};
  if (type === undefined || from === undefined || to === undefined) {
    return jsonResponse(400, { error: 'type, from and to query parameters are required' });
  }
  if (!isMeasurementType(type)) {
    return jsonResponse(400, { error: 'type must be one of blood_pressure, body_mass' });
  }
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (Number.isNaN(fromMs)) {
    return jsonResponse(400, { error: 'from must be an ISO-8601 timestamp' });
  }
  if (Number.isNaN(toMs)) {
    return jsonResponse(400, { error: 'to must be an ISO-8601 timestamp' });
  }
  if (fromMs >= toMs) {
    return jsonResponse(400, { error: 'from must be before to' });
  }
  const measurements = await repository.findByTypeAndRange(type, new Date(fromMs), new Date(toMs));
  return jsonResponse(200, measurements);
}

function isMeasurementType(value: string): value is MeasurementType {
  return value === 'blood_pressure' || value === 'body_mass';
}

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}

// Wired at module init: a Lambda whose TABLE_NAME is unset is misconfigured
// and should fail loudly at init, not per request.
const tableName = process.env['TABLE_NAME'];
if (tableName === undefined) {
  throw new Error('TABLE_NAME environment variable is not set');
}

export const handler = createHandler({
  repository: new DynamoDbMeasurementRepository(
    DynamoDBDocumentClient.from(new DynamoDBClient({})),
    tableName
  )
});
