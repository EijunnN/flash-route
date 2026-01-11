/**
 * Geospatial utilities for Story 17.1: Optimización de Consultas Geoespaciales
 *
 * This module provides PostGIS-based distance calculations and spatial queries
 * with caching support for improved performance.
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { cacheGet, cacheSet, CACHE_TTL } from "./cache";

// Distance result in meters and seconds
export interface DistanceResult {
  distanceMeters: number;
  durationSeconds: number;
}

// Coordinate pair
export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Distance matrix cache key
type DistanceMatrixKey = `${string}-${string}`;

/**
 * Calculate the distance between two points using PostGIS ST_Distance
 * Returns distance in meters
 *
 * @param from - Starting coordinates
 * @param to - Ending coordinates
 * @returns Distance in meters
 */
export async function calculateDistance(
  from: Coordinates,
  to: Coordinates
): Promise<number> {
  const result = await db.execute(sql`
    SELECT ST_Distance(
      ST_SetSRID(ST_MakePoint(${from.longitude}, ${from.latitude}), 4326)::geography,
      ST_SetSRID(ST_MakePoint(${to.longitude}, ${to.latitude}), 4326)::geography
    ) as distance
  `);

  const row = result[0] as { distance: number } | undefined;
  return Math.round(row?.distance || 0);
}

/**
 * Calculate the distance between two points with duration estimation
 * Uses an average speed of 40 km/h in urban areas for duration calculation
 *
 * @param from - Starting coordinates
 * @param to - Ending coordinates
 * @returns Distance in meters and estimated duration in seconds
 */
export async function calculateDistanceWithDuration(
  from: Coordinates,
  to: Coordinates
): Promise<DistanceResult> {
  const distanceMeters = await calculateDistance(from, to);

  // Average urban speed: 40 km/h = ~11.11 m/s
  const averageSpeedMetersPerSecond = 40 * 1000 / 3600;
  const durationSeconds = Math.round(distanceMeters / averageSpeedMetersPerSecond);

  return {
    distanceMeters,
    durationSeconds,
  };
}

/**
 * Calculate distance from an order by ID to a point
 *
 * @param orderId - Order ID
 * @param to - Target coordinates
 * @returns Distance in meters and estimated duration in seconds
 */
export async function calculateDistanceFromOrder(
  orderId: string,
  to: Coordinates
): Promise<DistanceResult> {
  const result = await db.execute(sql`
    SELECT
      ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(${to.longitude}, ${to.latitude}), 4326)::geography
      ) as distance
    FROM orders
    WHERE id = ${orderId}
  `);

  const row = result[0] as { distance: number } | undefined;
  const distanceMeters = Math.round(row?.distance || 0);
  const averageSpeedMetersPerSecond = 40 * 1000 / 3600;
  const durationSeconds = Math.round(distanceMeters / averageSpeedMetersPerSecond);

  return {
    distanceMeters,
    durationSeconds,
  };
}

/**
 * Calculate distance from depot to an order
 *
 * @param depotCoordinates - Depot coordinates
 * @param orderId - Order ID
 * @returns Distance in meters and estimated duration in seconds
 */
export async function calculateDistanceFromDepotToOrder(
  depotCoordinates: Coordinates,
  orderId: string
): Promise<DistanceResult> {
  const result = await db.execute(sql`
    SELECT
      ST_Distance(
        ST_SetSRID(ST_MakePoint(${depotCoordinates.longitude}, ${depotCoordinates.latitude}), 4326)::geography,
        location
      ) as distance
    FROM orders
    WHERE id = ${orderId}
  `);

  const row = result[0] as { distance: number } | undefined;
  const distanceMeters = Math.round(row?.distance || 0);
  const averageSpeedMetersPerSecond = 40 * 1000 / 3600;
  const durationSeconds = Math.round(distanceMeters / averageSpeedMetersPerSecond);

  return {
    distanceMeters,
    durationSeconds,
  };
}

/**
 * Calculate distance matrix for multiple points
 * Caches results in Redis for improved performance
 *
 * @param coordinates - Array of coordinates
 * @param companyId - Company ID for cache namespacing
 * @returns Distance matrix as 2D array [i][j] = distance from i to j
 */
export async function calculateDistanceMatrix(
  coordinates: Coordinates[],
  companyId: string
): Promise<number[][]> {
  const n = coordinates.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  // Create cache key from sorted coordinate pairs
  const coordKey = coordinates
    .map((c) => `${c.latitude.toFixed(6)},${c.longitude.toFixed(6)}`)
    .sort()
    .join("|");
  const cacheKey = `geospatial:distance_matrix:${companyId}:${coordKey}`;

  // Try to get from cache
  const cached = await cacheGet<number[][]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Calculate distances using PostGIS
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const distance = await calculateDistance(coordinates[i], coordinates[j]);
      matrix[i][j] = distance;
      matrix[j][i] = distance; // Symmetric matrix
    }
  }

  // Cache the result (24 hours TTL for distance matrices)
  await cacheSet(cacheKey, matrix, CACHE_TTL.GEOCODING);

  return matrix;
}

/**
 * Find nearby orders within a given radius
 *
 * @param center - Center coordinates
 * @param radiusMeters - Search radius in meters
 * @param companyId - Company ID for filtering
 * @returns Array of nearby orders with their distances
 */
export async function findNearbyOrders(
  center: Coordinates,
  radiusMeters: number,
  companyId: string
): Promise<Array<{ orderId: string; distance: number }>> {
  const result = await db.execute(sql`
    SELECT
      id as order_id,
      ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(${center.longitude}, ${center.latitude}), 4326)::geography
      ) as distance
    FROM orders
    WHERE
      company_id = ${companyId}
      AND ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint(${center.longitude}, ${center.latitude}), 4326)::geography,
        ${radiusMeters}
      )
      AND active = true
    ORDER BY distance ASC
  `);

  return (result as unknown as Array<{ order_id: string; distance: number }>).map((row) => ({
    orderId: row.order_id,
    distance: Math.round(row.distance),
  }));
}

/**
 * Calculate total route distance passing through multiple stops
 *
 * @param stops - Array of coordinates in order
 * @returns Total distance in meters and total duration in seconds
 */
export async function calculateRouteDistance(
  stops: Coordinates[]
): Promise<DistanceResult> {
  if (stops.length < 2) {
    return { distanceMeters: 0, durationSeconds: 0 };
  }

  let totalDistance = 0;

  for (let i = 0; i < stops.length - 1; i++) {
    const distance = await calculateDistance(stops[i], stops[i + 1]);
    totalDistance += distance;
  }

  const averageSpeedMetersPerSecond = 40 * 1000 / 3600;
  const durationSeconds = Math.round(totalDistance / averageSpeedMetersPerSecond);

  return {
    distanceMeters: totalDistance,
    durationSeconds,
  };
}

/**
 * Calculate distance from route stop to another location
 *
 * @param routeStopId - Route stop ID
 * @param to - Target coordinates
 * @returns Distance in meters and estimated duration in seconds
 */
export async function calculateDistanceFromRouteStop(
  routeStopId: string,
  to: Coordinates
): Promise<DistanceResult> {
  const result = await db.execute(sql`
    SELECT
      ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(${to.longitude}, ${to.latitude}), 4326)::geography
      ) as distance
    FROM route_stops
    WHERE id = ${routeStopId}
  `);

  const row = result[0] as { distance: number } | undefined;
  const distanceMeters = Math.round(row?.distance || 0);
  const averageSpeedMetersPerSecond = 40 * 1000 / 3600;
  const durationSeconds = Math.round(distanceMeters / averageSpeedMetersPerSecond);

  return {
    distanceMeters,
    durationSeconds,
  };
}

/**
 * Batch calculate distances for multiple pairs
 * More efficient than individual calculations for large batches
 *
 * @param pairs - Array of coordinate pairs
 * @returns Array of distances in meters
 */
export async function batchCalculateDistances(
  pairs: Array<{ from: Coordinates; to: Coordinates }>
): Promise<number[]> {
  if (pairs.length === 0) {
    return [];
  }

  // Use UNNEST to process all pairs in a single query
  const values = pairs.map(
    (p, i) => `(${p.from.longitude}, ${p.from.latitude}, ${p.to.longitude}, ${p.to.latitude}, ${i})`
  ).join(", ");

  const result = await db.execute(sql`
    WITH pairs(from_lng, from_lat, to_lng, to_lat, idx) AS (
      VALUES ${sql.raw(values)}
    )
    SELECT
      idx,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(from_lng, from_lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(to_lng, to_lat), 4326)::geography
      ) as distance
    FROM pairs
    ORDER BY idx
  `);

  // Sort by index and return distances
  const distances = new Array<number>(pairs.length).fill(0);
  for (const row of result as unknown as Array<{ idx: number; distance: number }>) {
    distances[row.idx] = Math.round(row.distance);
  }

  return distances;
}

/**
 * Invalidate distance matrix cache for a company
 * Should be called when orders are updated or new orders are added
 *
 * @param companyId - Company ID
 */
export async function invalidateDistanceCache(companyId: string): Promise<void> {
  // Use cache pattern to invalidate - the cache will be rebuilt on next access
  // For now we rely on TTL expiration, but this function can be extended
  // to use a more explicit invalidation strategy if needed
}
