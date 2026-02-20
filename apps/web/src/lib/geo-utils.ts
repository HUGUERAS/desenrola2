/**
 * geo-utils.ts — Utilidades de geometria para o Desenrola
 * Conversoes WKT/GeoJSON, calculo de area, perimetro, centroid
 */

/**
 * Parse WKT POLYGON/MULTIPOLYGON to rings array
 */
export function wktToRings(wkt: string): number[][][] | null {
  if (!wkt) return null;

  try {
    // POLYGON((x1 y1, x2 y2, ...))
    const polyMatch = wkt.match(/POLYGON\s*\(\((.+)\)\)/i);
    if (polyMatch) {
      const coords = polyMatch[1].split(',').map((pair) => {
        const [x, y] = pair.trim().split(/\s+/).map(Number);
        return [x, y];
      });
      return [coords];
    }

    // MULTIPOLYGON(((x1 y1, x2 y2, ...)))
    const multiMatch = wkt.match(/MULTIPOLYGON\s*\(\(\((.+)\)\)\)/i);
    if (multiMatch) {
      const coords = multiMatch[1].split(',').map((pair) => {
        const [x, y] = pair.trim().split(/\s+/).map(Number);
        return [x, y];
      });
      return [coords];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract rings from GeoJSON geometry
 */
export function geoJSONToRings(geojson: Record<string, any>): number[][][] | null {
  if (!geojson) return null;

  try {
    const geom = geojson.geometry || geojson;
    const type = geom.type;
    const coords = geom.coordinates;

    if (!coords) return null;

    if (type === 'Polygon') {
      return coords as number[][][];
    }

    if (type === 'MultiPolygon') {
      // Return first polygon's rings
      return coords[0] as number[][][];
    }

    if (type === 'Feature') {
      return geoJSONToRings(geom);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Convert ring coordinates to GeoJSON Polygon
 */
export function ringsToGeoJSON(ring: number[][]): Record<string, any> {
  // Ensure ring is closed
  const closed = [...ring];
  if (
    closed.length > 0 &&
    (closed[0][0] !== closed[closed.length - 1][0] ||
      closed[0][1] !== closed[closed.length - 1][1])
  ) {
    closed.push([...closed[0]]);
  }

  return {
    type: 'Polygon',
    coordinates: [closed],
  };
}

/**
 * Calculate centroid of a ring
 */
export function calculateCentroid(ring: number[][]): [number, number] {
  if (!ring || ring.length === 0) return [0, 0];

  let sumX = 0;
  let sumY = 0;
  const n = ring[0][0] === ring[ring.length - 1]?.[0] &&
    ring[0][1] === ring[ring.length - 1]?.[1]
    ? ring.length - 1
    : ring.length;

  for (let i = 0; i < n; i++) {
    sumX += ring[i][0];
    sumY += ring[i][1];
  }

  return [sumX / n, sumY / n];
}

/**
 * Calculate area in square meters using the Shoelace formula + spherical correction
 */
export function calculateAreaM2(ring: number[][]): number {
  if (!ring || ring.length < 3) return 0;

  // Use spherical excess for better accuracy
  const R = 6371000; // Earth radius in meters
  let area = 0;
  const n = ring.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[j];

    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    area += dLon * (2 + Math.sin(lat1Rad) + Math.sin(lat2Rad));
  }

  area = Math.abs((area * R * R) / 2);
  return area;
}

/**
 * Calculate perimeter in meters using Haversine
 */
export function calculatePerimeterM(ring: number[][]): number {
  if (!ring || ring.length < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    perimeter += haversineDistance(ring[i], ring[i + 1]);
  }

  // Close the ring if not closed
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    perimeter += haversineDistance(last, first);
  }

  return perimeter;
}

/**
 * Haversine distance between two [lon, lat] points in meters
 */
function haversineDistance(p1: number[], p2: number[]): number {
  const R = 6371000;
  const [lon1, lat1] = p1;
  const [lon2, lat2] = p2;

  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
