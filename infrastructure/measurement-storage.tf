# The measurements table — the data model for the service.
#
# Base table: per-device history. pk = `<model>#<serialNumber>` scopes one
# device's measurements; sk = `<takenAtUtc>#<type>` orders them chronologically
# and completes the natural key (model + serialNumber + takenAtUtc + type) as
# the item identity — re-delivered submissions rewrite the same item
# (idempotent last-write-wins).
#
# GSI by-type-and-time: serves `GET /measurements?type&from&to`. typeTimeKey =
# `<takenAtUtc>#<model>#<serialNumber>` with takenAtUtc in fixed
# `YYYY-MM-DDTHH:mm:ss.SSSZ` format, so lexicographic order is chronological
# order and the range is a single Query. Projection ALL: retrieval never
# fetches back to the base table.
#
# The test-side source of this shape is
# services/measurements/src/core/table-definition.ts — keep the two in sync.
# Naming and tags come from the label module in main.tf.

resource "aws_dynamodb_table" "measurements" {
  name         = module.label.id
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "pk"
  range_key = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "type"
    type = "S"
  }

  attribute {
    name = "typeTimeKey"
    type = "S"
  }

  global_secondary_index {
    name            = "by-type-and-time"
    hash_key        = "type"
    range_key       = "typeTimeKey"
    projection_type = "ALL"
  }

  tags = module.label.tags
}
