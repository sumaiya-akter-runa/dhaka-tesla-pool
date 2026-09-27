# Architecture Notes

See the top-level `README.md` for the day-one architecture, ERD, lifecycle,
matching rule, fare model, and concurrency fix. This file covers the two
things that don't belong in day-one code: why the stack stays deliberately
small, and how it would change at scale.

## Why not microservices / Kafka / Redis / Kubernetes?

At this scale — a handful of users, one Postgres database, one
vehicle-capacity rule to enforce — those tools add operational complexity
(more services to deploy, more failure points, more surface area to
explain) without solving a problem this project actually has yet. A layered
monolith (Next.js → Express → Postgres) is easy to reason about and easy to
defend in an interview: "data flows one direction, logic lives in the API
layer."

## Bonus: scaling to 1M passengers / 100k drivers

This is a thought exercise, not something built for the MVP.

```
Browser
  │
Load Balancer
  │
API Node 1..N  ──┬──► Redis Cache (hot lookups, e.g. "open pools in Banani")
  │               │
  │               └──► Match Event Queue → Matching Workers
  │
Postgres Primary ──► Read Replica(s)
```

- **Horizontal API scaling** behind a load balancer — the API is stateless
  (JWT, no server-side sessions), so any node can handle any request.
- **Read replicas** for Postgres — most traffic is reads (status checks,
  history); writes (seat reservations) stay on the primary.
- **Indexes** on `pickup_zone`, `status`, and `vehicle_id` — already added
  in the MVP schema, since they're the columns every matching query filters
  on regardless of scale.
- **Redis cache** for hot lookups ("which pools are open in Banani right
  now") to avoid hitting Postgres on every request.
- **A queue** (SQS/Kafka) for match events, so matching becomes
  asynchronous instead of blocking the request — the passenger sees
  "searching for a pool…" instead of waiting on a slow synchronous call.
- **Geospatial indexing** (PostGIS) once zones are replaced by real
  coordinates.
- **WebSockets/SSE** for real-time driver/passenger status instead of
  polling (the MVP frontend currently polls every 4s).
- **Idempotency keys** on ride-request endpoints, so a retried network
  request can't create two ride requests.
- **Rate limiting** per user to stop abuse.
- **Observability**: structured logs, metrics, and tracing so a slow or
  failing request can actually be diagnosed.
- **Distributed locking / single-writer-per-pool** to replace the plain
  transactional `UPDATE` once contention on a single pool row becomes
  frequent enough to matter — at MVP scale, the atomic `UPDATE` alone is
  enough and is honest about what it's doing.
