# Optional bonus: the compute plane matching the README architecture —
# API Gateway HTTP API → single Lambda (method dispatch) → DynamoDB.
#
# This file is validate-only. The required artifact is the table
# (measurement-storage.tf), and the LocalStack `terraform apply` walkthrough
# covers DynamoDB alone — so everything here is gated behind `deploy_compute`
# (default false) and the required apply keeps seeing only the table. Lambda
# and HTTP API emulation are out of scope locally; do not flip the flag
# against the LocalStack endpoint.
#
# Packaging: `filename` points at a pre-built zip rather than a
# data "archive_file". The zip is a build artifact produced by CI (or
# locally) with `cd services/measurements && npm run build && printf
# '{"type":"module"}' > dist/package.json && zip -r dist-lambda.zip
# dist`; using it directly avoids pulling in the hashicorp/archive
# provider just to repackage what the build already made. Besides the
# compiled dist/, the zip MUST also carry a minimal package.json with
# {"type":"module"} (the workspace's own package.json works too): the
# workspace is "type": "module" and tsc emits ESM, so the marker makes
# nodejs22.x resolve the .js files as ESM deterministically rather than
# relying on syntax detection. Nothing else is needed — the nodejs22.x
# runtime bundles AWS SDK v3 and the service has no other runtime
# dependency.

variable "deploy_compute" {
  type        = bool
  default     = false
  description = "Create the HTTP API + Lambda compute plane. Default false so the required table-only apply never attempts Lambda/API Gateway resources."
}

locals {
  lambda_package = "${path.module}/../services/measurements/dist-lambda.zip"
}

resource "aws_iam_role" "ingest" {
  count = var.deploy_compute ? 1 : 0

  name = "${module.label.id}-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = module.label.tags
}

# Lambda basic logging, scoped to this function's log group. Region/account
# are wildcarded: this configuration pins us-east-1 in the provider, and
# nothing is gained by restating it in the ARN.
resource "aws_iam_role_policy" "ingest_logs" {
  count = var.deploy_compute ? 1 : 0

  name = "${module.label.id}-logs"
  role = aws_iam_role.ingest[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ]
      Resource = "arn:aws:logs:*:*:log-group:/aws/lambda/${module.label.id}:*"
    }]
  })
}

# Least privilege: only the writes (BatchWriteItem) and reads (Query) the
# repository actually issues, scoped to the table and its GSI. Deriving both
# ARNs from the table resource keeps this correct anywhere without
# data.aws_caller_identity — which this LocalStack-pointed provider cannot
# serve (skip_requesting_account_id = true, only dynamodb has an endpoint).
resource "aws_iam_role_policy" "ingest_dynamodb" {
  count = var.deploy_compute ? 1 : 0

  name = "${module.label.id}-dynamodb"
  role = aws_iam_role.ingest[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:BatchWriteItem",
        "dynamodb:Query"
      ]
      Resource = [
        aws_dynamodb_table.measurements.arn,
        "${aws_dynamodb_table.measurements.arn}/index/*"
      ]
    }]
  })
}

resource "aws_lambda_function" "ingest" {
  count = var.deploy_compute ? 1 : 0

  function_name = module.label.id
  role          = aws_iam_role.ingest[0].arn
  runtime       = "nodejs22.x"
  handler       = "dist/entry/index.handler"
  filename      = local.lambda_package

  # Forces a redeploy whenever the CI-built zip changes. The fileexists guard
  # keeps `terraform validate` (which evaluates functions even at count = 0)
  # green on a checkout where the artifact has not been built; when the zip
  # is missing the provider derives the hash at apply instead.
  source_code_hash = fileexists(local.lambda_package) ? filebase64sha256(local.lambda_package) : null

  memory_size = 256
  timeout     = 5

  environment {
    variables = {
      # The handler fails at init without this (services/measurements/src/entry/index.ts).
      TABLE_NAME = aws_dynamodb_table.measurements.name
    }
  }

  tags = module.label.tags
}

resource "aws_lambda_permission" "api_invoke" {
  count = var.deploy_compute ? 1 : 0

  statement_id  = "AllowHttpApiInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ingest[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.measurements[0].execution_arn}/*/*"
}

resource "aws_apigatewayv2_api" "measurements" {
  count = var.deploy_compute ? 1 : 0

  name          = module.label.id
  protocol_type = "HTTP"

  tags = module.label.tags
}

# One integration: the Lambda dispatches on method internally. Payload format
# 2.0 is the APIGatewayProxyEventV2 shape the handler consumes.
resource "aws_apigatewayv2_integration" "measurements" {
  count = var.deploy_compute ? 1 : 0

  api_id                 = aws_apigatewayv2_api.measurements[0].id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.ingest[0].arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "post_measurements" {
  count = var.deploy_compute ? 1 : 0

  api_id    = aws_apigatewayv2_api.measurements[0].id
  route_key = "POST /measurements"
  target    = "integrations/${aws_apigatewayv2_integration.measurements[0].id}"
}

resource "aws_apigatewayv2_route" "get_measurements" {
  count = var.deploy_compute ? 1 : 0

  api_id    = aws_apigatewayv2_api.measurements[0].id
  route_key = "GET /measurements"
  target    = "integrations/${aws_apigatewayv2_integration.measurements[0].id}"
}

# The handler matches the /measurements suffix, so the staged invoke path
# (/dev/measurements) is expected — see the comment in the entry code.
resource "aws_apigatewayv2_stage" "dev" {
  count = var.deploy_compute ? 1 : 0

  api_id      = aws_apigatewayv2_api.measurements[0].id
  name        = "dev"
  auto_deploy = true

  tags = module.label.tags
}
