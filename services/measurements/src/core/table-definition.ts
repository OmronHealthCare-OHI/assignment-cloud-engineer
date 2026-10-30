import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

/**
 * The GSI serving `GET /measurements?type&from&to`: `type` partitions,
 * `typeTimeKey` = `<takenAtUtc>#<model>#<serialNumber>` ranges in UTC time
 * order, so a range query is one Query with `[from, to)` bounds.
 */
export const GSI_BY_TYPE_AND_TIME = 'by-type-and-time';

/**
 * The measurements table shape — base keys `pk` = `<model>#<serialNumber>`,
 * `sk` = `<takenAtUtc>#<type>`. Together with the item attributes they make
 * the natural key (model + serialNumber + takenAtUtc + type) the item
 * identity, so re-delivered submissions rewrite the same item (idempotent
 * last-write-wins, no conditionals).
 *
 * This is the single source for tests (the in-process DynamoDB harness);
 * `infrastructure/measurement-storage.tf` is the deployed mirror — keep the
 * two in sync.
 */
export function measurementTableDefinition(tableName: string): CreateTableCommandInput {
  return {
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
      { AttributeName: 'type', AttributeType: 'S' },
      { AttributeName: 'typeTimeKey', AttributeType: 'S' }
    ],
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: GSI_BY_TYPE_AND_TIME,
        KeySchema: [
          { AttributeName: 'type', KeyType: 'HASH' },
          { AttributeName: 'typeTimeKey', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' }
      }
    ]
  };
}
