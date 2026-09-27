-- Initial schema for Dhaka Tesla Pool, mirroring backend/prisma/schema.prisma.

-- pgcrypto provides gen_random_uuid(), used as the default for every id column.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "Role" AS ENUM ('PASSENGER', 'DRIVER');
CREATE TYPE "VehicleStatus" AS ENUM ('ONLINE', 'OFFLINE');
CREATE TYPE "RideStatus" AS ENUM ('REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PoolStatus" AS ENUM ('OPEN', 'FULL', 'CLOSED');

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "vehicles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "driver_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'OFFLINE',
    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "pools" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vehicle_id" UUID NOT NULL,
    "status" "PoolStatus" NOT NULL DEFAULT 'OPEN',
    "pickup_zone" TEXT NOT NULL,
    "destination_zone" TEXT NOT NULL,
    "occupied_seats" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pools_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pools_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "pools_vehicle_id_idx" ON "pools"("vehicle_id");
CREATE INDEX "pools_pickup_zone_status_idx" ON "pools"("pickup_zone", "status");

CREATE TABLE "ride_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "passenger_id" UUID NOT NULL,
    "pickup_zone" TEXT NOT NULL,
    "destination_zone" TEXT NOT NULL,
    "seats_requested" INTEGER NOT NULL DEFAULT 1,
    "status" "RideStatus" NOT NULL DEFAULT 'REQUESTED',
    "fare_paisa" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ride_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ride_requests_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ride_requests_passenger_id_idx" ON "ride_requests"("passenger_id");
CREATE INDEX "ride_requests_pickup_zone_status_idx" ON "ride_requests"("pickup_zone", "status");

CREATE TABLE "pool_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pool_id" UUID NOT NULL,
    "ride_request_id" UUID NOT NULL,
    "seats" INTEGER NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pool_memberships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pool_memberships_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pool_memberships_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "pool_memberships_ride_request_id_key" ON "pool_memberships"("ride_request_id");

CREATE TABLE "ride_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ride_request_id" UUID NOT NULL,
    "status" "RideStatus" NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" UUID NOT NULL,
    CONSTRAINT "ride_status_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ride_status_history_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ride_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
