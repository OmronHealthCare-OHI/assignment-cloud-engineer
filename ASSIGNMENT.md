# Cloud Engineer — Technical Assignment — OMRON

> **⚠️ DRAFT — pending kickoff decisions (2026-08-26).** Open: scope guard confirmation,
> AI policy confirmation, repo home. Settled by the author pre-kickoff: DynamoDB as given
> storage, table resource as the required Terraform piece, rest of IaC optional-bonus.

## The situation

At OMRON we build connected health services. Devices — blood pressure monitors, weight
scales — sync to our mobile app over Bluetooth; the app normalizes the vendor formats
and submits measurements to the cloud. We are starting a lightweight measurements
service that ingests those submissions and makes measurements retrievable for the app.

This repository is the start of that service: the harness, the givens, and the gaps
where your design goes.

## The intent

When you are done, a reviewer should be able to walk from your architecture diagram to
your table design to your code and tests and find **one coherent design** — each layer
explaining the next. That is what the assignment is for: the daily job here is
integrating cloud design, data, and code under constraints, and we would rather see how
you think than how much you can complete.

**If the time box forces trade-offs, protect the data model.** A defended DynamoDB
table design with a thin slice of working code beats complete endpoints on an
unconsidered model.

## Givens

- **The API perimeter** — paths, query parameters, and the submission schema are fixed
  in [`openapi.yaml`](openapi.yaml). One thing is deliberately open: the shape of the
  Measurement returned on retrieval follows from your data model — update the spec to
  match what you design.
- **Storage: DynamoDB.** The `aws_dynamodb_table` resource in
  `infrastructure/measurement-storage.tf` is the one **required** piece of Terraform —
  it *is* your data model. Terraform for the rest of your architecture is an optional
  bonus; a diagram fully answers the architecture.
- **Submissions can arrive more than once** — retried pushes, device re-syncs (see
  `fixtures/`) — **and carry no identifier of their own.** How you determine what you
  have already seen, and your position on duplicates, are part of the design.
- **The harness is scaffolded and green** — workspace, tooling, in-process DynamoDB
  test harness, CI (`npm install && npm test` to see it run). Comments in the code mark
  where the design gaps are.

## Freedoms

- Compute, data flow, canonical model, duplicates position, and how you structure the
  inside of `src/core/` — all yours. We are not looking for a particular pattern, and
  the scaffolded signatures are starting points, not contracts.
- AI tools are explicitly allowed — tell us how you used them and how you verified
  their output.

## Boundaries

- **2–4 hours.** Don't overengineer — incomplete-but-coherent beats
  complete-but-shallow.
- Scope: two measurement types, ingest + retrieve only. No auth flows, no device
  provisioning, no real AWS account.
- Keep the provided checks green: `npm test`, `npm run lint`, `npm run build`.

## Deliverables — your README, along four elements

This is where you play your design back to us; write it so we arrive at the
conversation already understanding your intent.

1. **Architectural overview** — the AWS architecture for ingest → store → retrieve, as
   a diagram plus a short rationale.
2. **Data structure and flow** — your table design and the position(s) you took, and
   why they serve the retrieval query.
3. **Implementation in TypeScript** — what you built, what you left out, and why.
4. **AI usage** - Did you use AI during the assignment? How did you do it?
5. **What could another team leverage from this setup?** — a second team will ship
   their own device integration; what should they reuse, what would you change to make
   that possible, and what would you write down for them?

Good luck!

The OMRON Team
