-- Migration for Story 17.1: Optimización de Consultas Geoespaciales
-- This migration adds PostGIS extension support and GIST indexes for geospatial queries

-- Step 1: Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Step 2: Add geography columns to existing tables for spatial queries
-- These columns will store the actual PostGIS geography points
-- We'll keep the existing latitude/longitude columns for backward compatibility

-- Add geography column to orders table
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "location" geography(POINT, 4326);

-- Add geography column to optimization_configurations table for depot
ALTER TABLE "optimization_configurations" ADD COLUMN IF NOT EXISTS "depot_location" geography(POINT, 4326);

-- Add geography column to route_stops table
ALTER TABLE "route_stops" ADD COLUMN IF NOT EXISTS "location" geography(POINT, 4326);

-- Step 3: Create GIST indexes on all geography columns
-- These indexes dramatically improve spatial query performance

CREATE INDEX IF NOT EXISTS "idx_orders_location_gist" ON "orders" USING GIST ("location");

CREATE INDEX IF NOT EXISTS "idx_optimization_configurations_depot_location_gist" ON "optimization_configurations" USING GIST ("depot_location");

CREATE INDEX IF NOT EXISTS "idx_route_stops_location_gist" ON "route_stops" USING GIST ("location");

-- Step 4: Create composite indexes for common query patterns
-- These improve performance of queries that filter by both company and location

CREATE INDEX IF NOT EXISTS "idx_orders_company_location" ON "orders" ("company_id", "location");

CREATE INDEX IF NOT EXISTS "idx_optimization_configurations_company_depot_location" ON "optimization_configurations" ("company_id", "depot_location");

CREATE INDEX IF NOT EXISTS "idx_route_stops_company_location" ON "route_stops" ("company_id", "location");

-- Step 5: Create indexes on latitude/longitude for backward compatibility
-- until all code is migrated to use geography columns

CREATE INDEX IF NOT EXISTS "idx_orders_latitude_longitude" ON "orders" ("latitude", "longitude");

CREATE INDEX IF NOT EXISTS "idx_optimization_configurations_depot_lat_long" ON "optimization_configurations" ("depot_latitude", "depot_longitude");

CREATE INDEX IF NOT EXISTS "idx_route_stops_latitude_longitude" ON "route_stops" ("latitude", "longitude");

-- Step 6: Create a function to automatically populate geography columns from lat/long
-- This trigger function will be called whenever latitude/longitude are inserted or updated

CREATE OR REPLACE FUNCTION update_geography_from_lat_long()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if we're updating orders table
  IF TG_TABLE_NAME = 'orders' THEN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
      NEW.location = ST_SetSRID(ST_MakePoint(CAST(NEW.longitude AS float8), CAST(NEW.latitude AS float8)), 4326)::geography;
    END IF;
  END IF;

  -- Check if we're updating optimization_configurations table
  IF TG_TABLE_NAME = 'optimization_configurations' THEN
    IF NEW.depot_latitude IS NOT NULL AND NEW.depot_longitude IS NOT NULL THEN
      NEW.depot_location = ST_SetSRID(ST_MakePoint(CAST(NEW.depot_longitude AS float8), CAST(NEW.depot_latitude AS float8)), 4326)::geography;
    END IF;
  END IF;

  -- Check if we're updating route_stops table
  IF TG_TABLE_NAME = 'route_stops' THEN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
      NEW.location = ST_SetSRID(ST_MakePoint(CAST(NEW.longitude AS float8), CAST(NEW.latitude AS float8)), 4326)::geography;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create triggers to automatically update geography columns
DROP TRIGGER IF EXISTS "trigger_orders_location_update" ON "orders";
CREATE TRIGGER "trigger_orders_location_update"
  BEFORE INSERT OR UPDATE OF "latitude", "longitude"
  ON "orders"
  FOR EACH ROW
  EXECUTE FUNCTION update_geography_from_lat_long();

DROP TRIGGER IF EXISTS "trigger_optimization_configurations_depot_location_update" ON "optimization_configurations";
CREATE TRIGGER "trigger_optimization_configurations_depot_location_update"
  BEFORE INSERT OR UPDATE OF "depot_latitude", "depot_longitude"
  ON "optimization_configurations"
  FOR EACH ROW
  EXECUTE FUNCTION update_geography_from_lat_long();

DROP TRIGGER IF EXISTS "trigger_route_stops_location_update" ON "route_stops";
CREATE TRIGGER "trigger_route_stops_location_update"
  BEFORE INSERT OR UPDATE OF "latitude", "longitude"
  ON "route_stops"
  FOR EACH ROW
  EXECUTE FUNCTION update_geography_from_lat_long();

-- Step 8: Populate existing records with geography data
UPDATE "orders" SET "location" = ST_SetSRID(ST_MakePoint(CAST("longitude" AS float8), CAST("latitude" AS float8)), 4326)::geography
WHERE "location" IS NULL AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL;

UPDATE "optimization_configurations" SET "depot_location" = ST_SetSRID(ST_MakePoint(CAST("depot_longitude" AS float8), CAST("depot_latitude" AS float8)), 4326)::geography
WHERE "depot_location" IS NULL AND "depot_latitude" IS NOT NULL AND "depot_longitude" IS NOT NULL;

UPDATE "route_stops" SET "location" = ST_SetSRID(ST_MakePoint(CAST("longitude" AS float8), CAST("latitude" AS float8)), 4326)::geography
WHERE "location" IS NULL AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL;
