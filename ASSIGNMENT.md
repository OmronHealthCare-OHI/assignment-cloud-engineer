# Cloud Engineer — Technical Assignment — OMRON

## The situation

At OMRON we build connected health services. Devices (blood pressure monitors, weight scales) sync to our mobile app over Bluetooth; the app normalizes the vendor formats and submits measurements to the cloud. We are starting a lightweight measurements service that ingests those submissions and makes measurements retrievable for the app.

## The intent

When you are done, a reviewer should be able to walk from your architecture diagram to your table design to your code and tests and find **one coherent design**: each layer explaining the next.
That is what the assignment is for: the daily job here is integrating cloud design, data, and code under constraints, and we would rather see how you think than how much you can complete.

**If the time box forces trade-offs, protect the data model.**
A defended DynamoDB table design with a thin slice of working code beats complete endpoints on an unconsidered model.

## Givens

- **The API perimeter**
  The [`openapi.yaml`](openapi.yaml) determines the paths, query parameters and the schema for the submission of data. You are responsible for the shape of the Measurements returned on retrieval that follows from your data model.
- **Storage: DynamoDB.**
  The `aws_dynamodb_table` resource in `infrastructure/measurement-storage.tf` is the one **required** piece of Terraform. Terraform for the rest of your architecture is an optional bonus; a diagram fully answers the architecture.
- **Submissions can arrive more than once**
  Retried pushes, device re-syncs (see `fixtures/`).
  How would you ensure idempotency for submissions?

## Freedoms

- Compute, data flow, canonical model, duplicates position, and how you structure the inside of `src/core/` are all yours to decide upon.
  We are not looking for a particular pattern, and the scaffolded signatures are starting points.
- AI tools are explicitly allowed, but tell us how you used them and how you verified their output.

## Boundaries

- **2–4 hours.** Don't overengineer: incomplete-but-coherent beats complete-but-shallow.
- Scope: two measurement types, ingest + retrieve only
- Keep the provided checks green: `npm test`, `npm run lint`, `npm run build`.

## Deliverables

1. **Architectural overview**
   The AWS architecture for ingest → store → retrieve, as a diagram plus a short rationale.
2. **Data structure and flow**
   Your table design and the position(s) you took, and why they serve the retrieval query.
3. **Implementation in TypeScript**
4. **AI usage**
   Did you use AI during the assignment? How did you do it?
5. **What could another team leverage from this setup?**
   A second team will ship their own device integration; what should they reuse, what would you change to make that possible, and what would you write down for them?

Good luck!

The OMRON Team
