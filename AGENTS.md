# Measurements Service — Agent Guide

This is the OMRON Cloud Engineer technical assignment. Read [ASSIGNMENT.md](ASSIGNMENT.md)
first — it carries the intent, the givens, the freedoms, and the deliverables. This file
maps the repository.

## Directory structure

| Path | What it is |
|------|-----------|
| `ASSIGNMENT.md` | The assignment brief: intent, givens, freedoms, boundaries, deliverables |
| `README.md` | The submission document — the four deliverable elements are written here |
| `openapi.yaml` | **Given:** the API perimeter (paths, parameters, submission schema). One deliberate hole: the retrieval-side `Measurement` schema is a placeholder — update it to match the designed data model |
| `fixtures/` | **Given:** realistic app submissions, including re-syncs that overlap earlier submissions. Submissions carry no identifier — identity handling is part of the design |
| `services/measurements/` | The service workspace (npm workspace) — the implementation lives here |
| `services/measurements/src/core/` | Domain logic: transport-unaware and directly testable. Internal structure is free — no particular pattern is expected |
| `services/measurements/src/core/submission.ts` | **Given:** ingest types mirroring `openapi.yaml` |
| `services/measurements/src/core/measurement-repository.ts` | The storage boundary: repository interface + DynamoDB skeleton. The table design goes to work here; the `Measurement` type is a placeholder to replace. Signatures are starting points, not contracts |
| `services/measurements/src/entry/` | The thin compute adapter — server, Lambda handler, or whatever the chosen architecture needs |
| `test/` | Root test directory (vitest) |
| `test/helpers/dynamodb.ts` | In-process DynamoDB (dynalite) — real CreateTable/Put/Query semantics, no Docker or AWS account |
| `test/dynamodb-harness.test.ts` | Working CreateTable/Put/Get example against the harness |
| `test/measurement-repository.test.ts` | Repository test scaffold; its todos name the expected coverage |
| `infrastructure/` | Terraform. `main.tf` carries the pre-filled CloudPosse label module — consume `module.label.id` and `module.label.tags`, don't modify it |
| `infrastructure/measurement-storage.tf` | **The required design artifact:** the `aws_dynamodb_table` resource *is* the data model (key schema, attributes, indexes) |
| `docker-compose.yml` | Optional local AWS emulation via LocalStack for `terraform apply` (`npm run infra:up`, endpoint `http://localhost:4566`, needs a free LocalStack account/token) — see `infrastructure/README.md` |
| `.env.example` | Copy to `.env` and set `LOCALSTACK_AUTH_TOKEN` if you want to run `infra:up` |

## Commands

```bash
npm install        # once
npm test           # vitest (root test/ dir)
npm run lint       # oxlint
npm run build      # tsc across workspaces
```

Terraform (from `infrastructure/`): `terraform init -backend=false`, then
`terraform validate` and `terraform fmt`. Pre-commit hooks are configured
(`pre-commit run --all-files`) but optional locally — CI runs the npm checks.

## Conventions

- TypeScript strict, ESM (`NodeNext`) — relative imports use `.js` extensions
- Terraform files are named by **purpose**, not by AWS service (`measurement-storage.tf`, not `dynamodb.tf`)
- Resource naming and tags come from the label module in `infrastructure/main.tf`
- The checks stay green: `npm test`, `npm run lint`, `npm run build`

## Role of the agent

The candidate remains the designer. The deliverables in ASSIGNMENT.md ask for *defended
choices* — table design, duplicates position, architecture — and the assignment's AI
policy requires reporting how AI was used and how its output was verified. Help with
execution; leave the positions to the candidate.
