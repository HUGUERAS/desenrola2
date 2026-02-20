import { describe, it, expect } from 'vitest';
import {
  wktToRings,
  geoJSONToRings,
  ringsToGeoJSON,
  calculateCentroid,
  calculateAreaM2,
  calculatePerimeterM,
} from '../geo-utils';

// Quadrado simples em Brasilia (~100m x ~100m)
const SQUARE_RING: number[][] = [
  [-47.93, -15.78],
  [-47.929, -15.78],
  [-47.929, -15.779],
  [-47.93, -15.779],
  [-47.93, -15.78], // fechado
];

describe('wktToRings', () => {
  it('deve parsear POLYGON WKT', () => {
    const wkt = 'POLYGON((-47.93 -15.78, -47.929 -15.78, -47.929 -15.779, -47.93 -15.779, -47.93 -15.78))';
    const rings = wktToRings(wkt);
    expect(rings).not.toBeNull();
    expect(rings!.length).toBe(1);
    expect(rings![0].length).toBe(5);
    expect(rings![0][0]).toEqual([-47.93, -15.78]);
  });

  it('deve parsear MULTIPOLYGON WKT', () => {
    const wkt = 'MULTIPOLYGON(((-47.93 -15.78, -47.929 -15.78, -47.929 -15.779, -47.93 -15.78)))';
    const rings = wktToRings(wkt);
    expect(rings).not.toBeNull();
    expect(rings!.length).toBe(1);
  });

  it('deve retornar null para WKT invalido', () => {
    expect(wktToRings('')).toBeNull();
    expect(wktToRings('POINT(0 0)')).toBeNull();
    expect(wktToRings('lixo')).toBeNull();
  });

  it('deve retornar null para input vazio', () => {
    expect(wktToRings('')).toBeNull();
  });
});

describe('geoJSONToRings', () => {
  it('deve extrair rings de Polygon', () => {
    const geojson = {
      type: 'Polygon',
      coordinates: [SQUARE_RING],
    };
    const rings = geoJSONToRings(geojson);
    expect(rings).not.toBeNull();
    expect(rings!.length).toBe(1);
    expect(rings![0]).toEqual(SQUARE_RING);
  });

  it('deve extrair rings de Feature com Polygon', () => {
    const geojson = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [SQUARE_RING],
      },
    };
    const rings = geoJSONToRings(geojson);
    expect(rings).not.toBeNull();
  });

  it('deve extrair primeiro poligono de MultiPolygon', () => {
    const geojson = {
      type: 'MultiPolygon',
      coordinates: [[SQUARE_RING], [SQUARE_RING]],
    };
    const rings = geoJSONToRings(geojson);
    expect(rings).not.toBeNull();
    expect(rings![0]).toEqual(SQUARE_RING);
  });

  it('deve retornar null para input invalido', () => {
    expect(geoJSONToRings(null as any)).toBeNull();
    expect(geoJSONToRings({})).toBeNull();
    expect(geoJSONToRings({ type: 'Point', coordinates: [0, 0] })).toBeNull();
  });
});

describe('ringsToGeoJSON', () => {
  it('deve converter ring para GeoJSON Polygon', () => {
    const result = ringsToGeoJSON(SQUARE_RING);
    expect(result.type).toBe('Polygon');
    expect(result.coordinates).toBeDefined();
    expect(result.coordinates[0].length).toBe(5);
  });

  it('deve fechar o ring se nao estiver fechado', () => {
    const openRing = [
      [-47.93, -15.78],
      [-47.929, -15.78],
      [-47.929, -15.779],
    ];
    const result = ringsToGeoJSON(openRing);
    const ring = result.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('nao deve duplicar fechamento se ja esta fechado', () => {
    const result = ringsToGeoJSON(SQUARE_RING);
    expect(result.coordinates[0].length).toBe(5);
  });
});

describe('calculateCentroid', () => {
  it('deve calcular centroid de um quadrado', () => {
    const centroid = calculateCentroid(SQUARE_RING);
    expect(centroid[0]).toBeCloseTo(-47.9295, 3);
    expect(centroid[1]).toBeCloseTo(-15.7795, 3);
  });

  it('deve retornar [0,0] para ring vazio', () => {
    expect(calculateCentroid([])).toEqual([0, 0]);
  });
});

describe('calculateAreaM2', () => {
  it('deve calcular area > 0 para poligono valido', () => {
    const area = calculateAreaM2(SQUARE_RING);
    expect(area).toBeGreaterThan(0);
  });

  it('area deve ser aprox 10000-15000 m2 para quadrado ~100m', () => {
    // ~0.001 grau ≈ ~111m lat, ~109m lon em -15.78
    const area = calculateAreaM2(SQUARE_RING);
    expect(area).toBeGreaterThan(5000);
    expect(area).toBeLessThan(20000);
  });

  it('deve retornar 0 para ring com menos de 3 pontos', () => {
    expect(calculateAreaM2([])).toBe(0);
    expect(calculateAreaM2([[0, 0], [1, 1]])).toBe(0);
  });
});

describe('calculatePerimeterM', () => {
  it('deve calcular perimetro > 0 para poligono valido', () => {
    const perimeter = calculatePerimeterM(SQUARE_RING);
    expect(perimeter).toBeGreaterThan(0);
  });

  it('perimetro deve ser aprox 400-500m para quadrado ~100m', () => {
    const perimeter = calculatePerimeterM(SQUARE_RING);
    expect(perimeter).toBeGreaterThan(300);
    expect(perimeter).toBeLessThan(600);
  });

  it('deve retornar 0 para ring vazio', () => {
    expect(calculatePerimeterM([])).toBe(0);
    expect(calculatePerimeterM([[0, 0]])).toBe(0);
  });
});
