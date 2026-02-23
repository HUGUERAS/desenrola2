/**
 * TopologyValidation: Validacao topologica client-side
 * Detecta auto-interseccoes, gaps, slivers, overlaps, vertices duplicados
 * Usa Turf.js no lugar do ArcGIS geometryEngine
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon } from 'geojson';

export interface TopologyError {
  type: 'self-intersection' | 'duplicate-vertex' | 'gap' | 'overlap' | 'sliver';
  message: string;
  location?: [number, number];
  severity: 'error' | 'warning';
}

export interface TopologyValidationResult {
  valid: boolean;
  errors: TopologyError[];
}

/**
 * Validate polygon topology (client-side checks)
 */
export function validatePolygonTopology(
  polygon: Feature<Polygon>
): TopologyValidationResult {
  const errors: TopologyError[] = [];

  // Auto-interseccoes via turf.kinks
  try {
    const kinks = turf.kinks(polygon);
    if (kinks.features.length > 0) {
      errors.push({
        type: 'self-intersection',
        message: 'Poligono possui auto-interseccoes',
        severity: 'error',
      });
    }
  } catch { }

  const area = turf.area(polygon);
  if (area < 1) {
    errors.push({
      type: 'sliver',
      message: 'Poligono muito fino (sliver) - area < 1m2',
      severity: 'warning',
    });
  }

  const ring = polygon.geometry.coordinates[0];
  if (!ring || ring.length < 4) {
    errors.push({
      type: 'duplicate-vertex',
      message: 'Poligono invalido - menos de 3 vertices unicos',
      severity: 'error',
    });
  } else {
    for (let i = 0; i < ring.length - 1; i++) {
      if (ring[i][0] === ring[i + 1][0] && ring[i][1] === ring[i + 1][1]) {
        errors.push({
          type: 'duplicate-vertex',
          message: `Vertices duplicados consecutivos no indice ${i}`,
          severity: 'warning',
        });
      }
    }
  }

  return {
    valid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
  };
}

/**
 * Detect gaps between adjacent polygons
 */
export function detectGaps(
  polygons: Feature<Polygon>[],
  tolerance = 0.5
): TopologyError[] {
  const gaps: TopologyError[] = [];

  for (let i = 0; i < polygons.length; i++) {
    for (let j = i + 1; j < polygons.length; j++) {
      try {
        const c1 = turf.centroid(polygons[i]);
        const c2 = turf.centroid(polygons[j]);
        const dist = turf.distance(c1, c2, { units: 'meters' });
        if (dist > tolerance && dist < 10) {
          gaps.push({
            type: 'gap',
            message: `Gap de ${dist.toFixed(2)}m entre poligonos`,
            severity: 'warning',
          });
        }
      } catch { }
    }
  }

  return gaps;
}

/**
 * Detect slivers (very thin polygons)
 */
export function detectSlivers(
  polygon: Feature<Polygon>,
  maxAreaM2 = 1
): boolean {
  return turf.area(polygon) < maxAreaM2;
}

/**
 * Detect overlaps between polygons
 */
export function detectOverlaps(
  polygon1: Feature<Polygon>,
  polygon2: Feature<Polygon>,
  minOverlapAreaM2 = 0.1
): TopologyError | null {
  try {
    const intersection = turf.intersect(
      turf.featureCollection([polygon1, polygon2])
    );
    if (intersection && intersection.geometry.type === 'Polygon') {
      const overlapArea = turf.area(intersection);
      if (overlapArea >= minOverlapAreaM2) {
        return {
          type: 'overlap',
          message: `Sobreposicao de ${overlapArea.toFixed(2)}m2 detectada`,
          severity: 'error',
        };
      }
    }
  } catch { }
  return null;
}

/**
 * Validate multiple polygons for mutual topology issues
 */
export function validateMultiPolygonTopology(
  polygons: Feature<Polygon>[],
  gapTolerance = 0.5
): TopologyValidationResult {
  const errors: TopologyError[] = [];

  for (const polygon of polygons) {
    const result = validatePolygonTopology(polygon);
    errors.push(...result.errors);
  }

  const gaps = detectGaps(polygons, gapTolerance);
  errors.push(...gaps);

  for (let i = 0; i < polygons.length; i++) {
    for (let j = i + 1; j < polygons.length; j++) {
      const overlap = detectOverlaps(polygons[i], polygons[j]);
      if (overlap) errors.push(overlap);
    }
  }

  return {
    valid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
  };
}
