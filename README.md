# Dhaka Tesla Pool

> Share a seat. Split the fare. Survive Dhaka traffic.

An MVP ride-pooling app: passengers (Nusrat, Rafiq, Shirin) request rides, a
driver (Jashim, in his 3-seat "Tesla" rickshaw **Bullet**) accepts and pools
compatible requests into one vehicle, and each passenger pays their own fare.

## 1. Summary

- **Problem:** let a handful of passengers going in roughly the same
  direction share one 3-seat vehicle, with each paying an individually
  calculated fare, without ever overbooking the vehicle.
- **Scope:** no real map routing, no payment gateway, no microservices —
  see [`docs/architecture.md`](docs/architecture.md) for the full reasoning.
- **Status:** backend API, frontend (passenger + driver flows), Docker
  Compose setup, and seed data are implemented. See [Known limitations](#11-known-limitations).

## 2. Architecture

```
Browser (Passenger / Driver)
        │  HTTPS / REST
        ▼
  Next.js Frontend  (frontend/)
        │  fetch() JSON
        ▼
  Node.js API — Express  (backend/)
        │
        ├── PostgreSQL (via Prisma)
        ├── Auth Service (JWT + bcrypt)
        ├── Pool Matching Engine
        ├── Fare Engine
        └── Ride State Machine
```

One browser → one frontend → one backend → one database. All business rules
(seat capacity, fare math, valid state transitions) live in the backend, in
`backend/src/services/`, so they can't be bypassed by a tampered frontend
request. See `docs/architecture.md` for why this project deliberately does
**not** use microservices, Kafka, Redis, or Kubernetes at this scale.

## 3. ERD

```
users ──< vehicles ──< pools ──< pool_memberships >── ride_requests >── ride_status_history
  │ owns                                                    │ makes
  └────────────────────────────────────────────────────────┘
```

| Table | Why it exists |
|---|---|
| `users` | One row per person (passenger or driver), distinguished by `role`. |
| `vehicles` | Jashim's Bullet. Holds `capacity` (3) — the single most-tested rule. |
| `ride_requests` | One row per ride ask — the passenger's *intent*, whether or not it gets pooled. |
| `pools` | One shared trip in one vehicle; can hold 1–3 passengers. |
| `pool_memberships` | Join table (`ride_request` ↔ `pool`) with `seats`, so `SUM(seats) <= capacity` is a single, lockable query. |
| `ride_status_history` | Append-only log of every status change, so the system can explain exactly what happened later. |

Full schema: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

## 4. Ride lifecycle (state machine)

```
REQUESTED → MATCHED → DRIVER_ARRIVED → STARTED → COMPLETED
    │           │
    └────→ CANCELLED ←┘
```

Enforced in `backend/src/services/rideStateMachine.js` — any transition not
on this diagram is rejected with `409`. Cancellation is only allowed while
`REQUESTED` or `MATCHED`.

## 5. Matching rule

A new ride request joins an existing open pool on a vehicle iff:

1. `pickupZone` matches the pool's pickup zone, **and**
2. `destinationZone` is on the documented compatible-zones list for that
   pool's destination (see `backend/src/lib/zones.js`), **and**
3. the vehicle has enough free seats, **and**
4. the vehicle is `ONLINE`.

Applied to the story: Nusrat (Banani → Mohakhali) and Rafiq (Banani →
Gulshan 1) share a pickup zone and compatible destinations, so they pool. A
Banani → Mirpur request would not, since it's a different direction and
isn't on Banani's compatible list.

## 6. Fare model

```
passengerFare = baseFare + distanceCharge − poolDiscount
```

Stored as **integers in paisa** (1 taka = 100 paisa) to avoid float
rounding bugs — see `backend/src/services/fareEngine.js`.

Worked example (also asserted in `backend/tests/fareEngine.test.js`):

- Nusrat → Mohakhali, pooled: `50 + 80 − 20 = ৳110`
- Rafiq → Gulshan 1, pooled: `50 + 65 − 20 = ৳95`

Payment is simulated (cash) — no real payment gateway.

## 7. Concurrency — the last-seat problem

Bullet has 1 seat left. Nusrat and Shirin both tap "Join" within the same
second; both saw "1 seat available" a moment earlier. The fix is a single
atomic `UPDATE` guarded by the capacity check in its own `WHERE` clause:

```sql
UPDATE pools
SET occupied_seats = occupied_seats + :seats
WHERE id = :pool_id
  AND occupied_seats + :seats <= :capacity
  AND status = 'OPEN'
```

See `backend/src/services/matchingEngine.js#reserveSeatAtomic`. Because a
single `UPDATE` is atomic in PostgreSQL, only one of two simultaneous
requests can ever affect a row — the loser gets `0` rows affected and a
`409`. At larger scale, this would move to a distributed lock (Redis) or a
single writer-per-pool queue — see Section 15 of `docs/architecture.md`.

## 8. Tech stack & why

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) | Routing built in; matches the brief's recommendation. |
| Backend | Node.js + Express | Minimal boilerplate, easy to explain end-to-end for an MVP. |
| Database | PostgreSQL | Strong relational integrity — exactly what seat-capacity/pool constraints need. |
| ORM | Prisma | Type-safe queries, fast migrations, good DX; raw SQL used only for the one atomic `UPDATE`. |
| Auth | JWT + bcrypt | Stateless — no server-side session store needed for an MVP. |
| Validation | Zod | TypeScript-friendly, composable schemas. |
| Testing | Jest + Supertest | Mature, low-setup. |
| REST vs GraphQL | REST | Maps naturally onto the ride lifecycle's discrete actions (accept/arrive/start/complete); the frontend's data needs are simple enough that GraphQL's added setup isn't worth it. |

## 9. Project structure

```
dhaka-tesla-pool/
├── backend/
│   ├── src/
│   │   ├── controllers/    # HTTP request/response handling
│   │   ├── services/       # matching, fare, state machine, status logging
│   │   ├── routes/
│   │   ├── middleware/     # auth, validation, error handling
│   │   ├── validators/     # Zod schemas
│   │   └── lib/            # prisma client, zones config
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.js         # Jashim, Bullet, Nusrat, Rafiq, Shirin
│   └── tests/
├── frontend/
│   └── app/{login,passenger,driver}/
├── docs/
│   └── architecture.md
├── docker-compose.yml
└── README.md
```

## 10. Running it

### Option A — Docker (recommended)

```bash
cp .env.example .env          # sets JWT_SECRET for the api container
docker compose up --build
```

- Frontend: http://localhost:3000
- API: http://localhost:4000 (health check at `/health`)
- Postgres: localhost:5432 (`tesla` / `tesla` / `dhaka_tesla_pool`)

The `api` container runs `prisma migrate deploy` then seeds the database
automatically on first start.

### Option B — Local development

```bash
# Terminal 1 — database
docker run -e POSTGRES_USER=tesla -e POSTGRES_PASSWORD=tesla \
  -e POSTGRES_DB=dhaka_tesla_pool -p 5432:5432 postgres:16-alpine

# Terminal 2 — backend
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run seed
npm run dev            # http://localhost:4000

# Terminal 3 — frontend
cd frontend
cp .env.example .env.local
npm install
npm run dev             # http://localhost:3000
```

### Demo credentials

All seeded users share the password `password123`:

| Role | Email |
|---|---|
| Driver (Jashim, owns Bullet) | `jashim@teslapool.dhaka` |
| Passenger | `nusrat@teslapool.dhaka` |
| Passenger | `rafiq@teslapool.dhaka` |
| Passenger | `shirin@teslapool.dhaka` |

### Tests

```bash
cd backend
npm test                              # unit tests (fare engine, state machine) — no DB needed
DATABASE_URL=... npm test             # also runs the DB-backed integration suite
```

## 11. API overview

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

POST   /api/rides                     # passenger: request a ride
GET    /api/rides/my
GET    /api/rides/:id
POST   /api/rides/:id/cancel

POST   /api/driver/vehicle/status     # go online/offline
GET    /api/driver/rides/requests     # pending REQUESTED requests
GET    /api/driver/rides/mine         # rides assigned to this driver's vehicle
POST   /api/driver/rides/:id/accept
POST   /api/driver/rides/:id/arrived
POST   /api/driver/rides/:id/start
POST   /api/driver/rides/:id/complete
```

## 12. Key decisions & trade-offs

1. **Pool discount applies once pooled, not on request.** A ride request's
   fare is only finalized on `accept`, once we know whether it landed in a
   pool with another passenger — the estimate shown at request time assumes
   solo, so the confirmed fare can differ slightly (this is documented in
   the UI as "estimated" vs. final).
2. **One matching pass, not a scoring algorithm.** The matching rule is a
   hand-maintained compatible-zones table rather than real distance/route
   scoring, per the brief's explicit guidance that this isn't being
   evaluated on routing sophistication.
3. **`pool_memberships` as a separate table**, not a FK on `ride_requests`,
   so the seat-count check (`SUM(seats) <= capacity`) and the atomic UPDATE
   both stay simple, single-table operations.

## 13. Known limitations

- No real geocoding/routing — zones are a fixed predefined list.
- No payment gateway (simulated/cash only).
- Matching only considers one driver's vehicle at accept-time, not a
  citywide dispatch across multiple idle vehicles.
- Frontend uses polling (4s) rather than WebSockets for status updates.

## 14. AI usage

This project was built with AI assistance (Claude). AI was used for
scaffolding the backend services, Prisma schema, and frontend pages against
the architecture already defined in `docs/architecture.md`.

- **Accepted:** the atomic single-`UPDATE` approach for seat reservation
  (Section 7) — it's simpler than a `SELECT ... FOR UPDATE` transaction and
  equally correct under Postgres's row-level locking.
- **Rejected/changed:** an initial draft computed pool discount at
  *request* time based on whether other open requests existed for the same
  zone. This was changed to compute the discount at *accept* time instead,
  once actual pool membership is known — the original approach could quote
  a discount that then didn't apply if no one else ended up pooling.

## 15. Deployment

_(fill in: public URL once deployed to a free-tier host, or document the
constraint per the brief and link the reproducible Docker setup above.)_

## 16. Demo video

_(fill in: 6-minute video link.)_
