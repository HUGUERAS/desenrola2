/**
 * TopologyValidation: Validacao topologica client-side
 * Detecta auto-interseccoes, gaps, slivers, overlaps, vertices duplicados
 */

import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';

export interface TopologyError {
  type: 'self-intersection' | 'duplicate-vertex' | 'gap' | 'overlap' | 'sliver';
  message: string;
  location?: __esri.Point;
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
  polygon: __esri.Polygon
): TopologyValidationResult {
  const errors: TopologyError[] = [];

  if (!geometryEngine.isSimple(polygon)) {
    errors.push({
      type: 'self-intersection',
      message: 'Poligono possui auto-interseccoes',
      severity: 'error',
    });
  }

  const area = geometryEngine.planarArea(polygon, 'square-meters');
  if (Math.abs(area) < 1) {
    errors.push({
      type: 'sliver',
      message: 'Poligono muito fino (sliver) - area < 1m2',
      severity: 'warning',
    });
  }

  const ring = polygon.rings[0];
  const vertexCount = ring?.length || 0;
  if (vertexCount < 4) {
    errors.push({
      type: 'duplicate-vertex',
      message: 'Poligono invalido - menos de 3 vertices unicos',
      severity: 'error',
    });
  }

  if (ring) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      if (x1 === x2 && y1 === y2) {
        errors.push({
          type: 'duplicate-vertex',
          message: `Vertices duplicados consecutivos no indice ${i}`,
          severity: 'warning',
        });
      }
    }
  }

  if (area < 0) {
    errors.push({
      type: 'self-intersection',
      message: 'Anel externo com orientacao anti-horaria (deve ser horario)',
      severity: 'warning',
    });
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
  polygons: __esri.Polygon[],
  tolerance: number = 0.5
): TopologyError[] {
  const gaps: TopologyError[] = [];

  for (let i = 0; i < polygons.length; i++) {
    for (let j = i + 1; j < polygons.length; j++) {
      const distance = geometryEngine.distance(polygons[i], polygons[j], 'meters');
      if (distance !== null && distance > tolerance && distance < 10) {
        gaps.push({
          type: 'gap',
          message: `Gap de ${distance.toFixed(2)}m entre poligonos`,
          severity: 'warning',
        });
      }
    }
  }

  return gaps;
}

/**
 * Detect slivers (very thin polygons)
 */
export function detectSlivers(
  polygon: __esri.Polygon,
  maxAreaM2: number = 1
): boolean {
  const area = Math.abs(geometryEngine.planarArea(polygon, 'square-meters'));
  return area < maxAreaM2;
}

/**
 * Detect overlaps between polygons
 */
export function detectOverlaps(
  polygon1: __esri.Polygon,
  polygon2: __esri.Polygon,
  minOverlapAreaM2: number = 0.1
): TopologyError | null {
  const intersection = geometryEngine.intersect(polygon1, polygon2);

  if (intersection && intersection.type === 'polygon') {
    const overlapArea = Math.abs(
      geometryEngine.planarArea(intersection as __esri.Polygon, 'square-meters')
    );

    if (overlapArea >= minOverlapAreaM2) {
      return {
        type: 'overlap',
        message: `Sobreposicao de ${overlapArea.toFixed(2)}m2 detectada`,
        severity: 'error',
      };
    }
  }

  return null;
}

/**
 * Validate multiple polygons for mutual topology issues
 */
export function validateMultiPolygonTopology(
  polygons: __esri.Polygon[],
  gapTolerance: number = 0.5
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
