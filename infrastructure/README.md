# Infrastructure

Terraform code for the measurements service lives here.

## Local apply (optional)

The required checks are `terraform init -backend=false`, `terraform validate`, and
`terraform fmt` (see the root `AGENTS.md`) — Terraform never needs to reach real AWS
for this assignment. If you want to go further and actually `terraform apply` your
table design somewhere (note: until you've written your own aws_dynamodb_table
resource, `apply` will show `0 added` — that's expected, module.label alone never
touches AWS), this repo points the AWS provider at
[LocalStack](https://www.localstack.cloud/) running in Docker.

This is optional verification for your own confidence, not a required deliverable —
don't let it eat into your timebox.

1. Get a free LocalStack account and auth token at https://app.localstack.cloud (no
   card needed for the "Hobby" tier). Do this before you start your timebox.
2. From the repo root: `cp .env.example .env` and fill in `LOCALSTACK_AUTH_TOKEN`.
3. `npm run infra:up` — starts LocalStack and waits until it's healthy.
4. From here (`infrastructure/`): `terraform init -backend=false && terraform apply -auto-approve`.
5. Your table's name is `module.label.id` (the pre-filled naming module in
   `main.tf`, which you don't touch), that resolves to `ohi-tst-measurements`. The
   AWS CLI needs *some* region and credentials even against a local endpoint (it
   won't reach real AWS, but it insists on the flags), so export dummy ones once
   per shell:

   ```bash
   export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1

   aws dynamodb put-item --table-name ohi-tst-measurements \
     --item '{"pk": {"S": "smoke-test"}}' --endpoint-url http://localhost:4566
   aws dynamodb scan --table-name ohi-tst-measurements \
     --endpoint-url http://localhost:4566
   ```

6. `npm run infra:down` when you're done.


<!-- BEGIN_TF_DOCS -->
<!-- END_TF_DOCS -->
