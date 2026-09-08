# Measurements Service — Candidate Submission

See [ASSIGNMENT.md](ASSIGNMENT.md) for the assignment. Structure your answers below.

## How to run

```bash
npm install
npm test
npm run lint
npm run build
```

Your implementation lives in the `services/measurements` workspace (`src/core/` for
domain logic, `src/entry/` for your compute adapter); tests go in `test/`.

This repo's Terraform is meant to be applied locally as you work, not just
validated, `npm run infra:up` starts a local AWS emulator, then `terraform apply`
from `infrastructure/` deploys your table design there so you're developing and
testing against something real, not just satisfying a linter. See
`infrastructure/README.md` for the full walkthrough. (The only strictly required
*checks* are `terraform validate`/`fmt`, see `AGENTS.md`, but applying locally as
you go is how this is meant to be worked, not extra credit.)

## 1. Architectural overview

### System context

```mermaid
C4Context
  title System Context — Measurements Service
  Person(user, "User", "Measures blood pressure and weight at home")
  System_Ext(device, "OMRON device", "Blood pressure monitor, weight scale")
  System_Ext(app, "OMRON mobile app", "Syncs devices over Bluetooth, normalizes vendor formats")
  System(svc, "Measurements Service", "Ingests measurement submissions and makes measurements retrievable")

  Rel(user, device, "Takes measurements")
  Rel(device, app, "Syncs readings", "Bluetooth")
  Rel(app, svc, "Submits and retrieves measurements", "REST/JSON")
```

### Containers

```mermaid
C4Container
  title Containers — Measurements Service
  System_Ext(app, "OMRON mobile app", "Submits and retrieves measurements")

  Container_Boundary(svc, "Measurements Service") {
    %% TODO: your compute container(s) go here — the architecture you chose
    ContainerDb(db, "Measurement storage", "DynamoDB", "Table design: infrastructure/measurement-storage.tf")
  }

  %% TODO: relationships — app to your entry point, your compute to storage
```

### Deployment

```mermaid
C4Deployment
  title Measurements Service
```

### Rationale

_Why this architecture: your compute choice, and the trade-offs you weighed._

## 2. Data structure and flow

_Your data model and flow description here._

## 3. Implementation in TypeScript

_Notes on your implementation: what you built, how to exercise it, what you left out._

## 4. AI usage

_Notes on your AI usage: Which model/skills/agents, rough setup._

## 4. What could another team leverage from this setup?

_Your answer here._

## Before production

_What would you add before this handles real production traffic, and why?_

## AI usage and verification

_How did you use AI tools, and how did you verify their output?_
