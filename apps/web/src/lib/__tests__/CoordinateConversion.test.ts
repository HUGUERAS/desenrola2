import { describe, it, expect } from 'vitest';
import {
  geographicToSIRGASUTM,
  sirgasUTMToGeographic,
  getUTMZone,
  getSIRGASEPSG,
  isValidBrazilCoordinate,
  toDMS,
  fromDMS,
} from '../geometry/CoordinateConversion';

describe('getUTMZone', () => {
  it('deve retornar zona 23 para Brasilia (-47.93)', () => {
    expect(getUTMZone(-47.93)).toBe(23);
  });

  it('deve retornar zona 23 para Sao Paulo (-46.63)', () => {
    expect(getUTMZone(-46.63)).toBe(23);
  });

  it('deve retornar zona 22 para Curitiba (-49.27)', () => {
    expect(getUTMZone(-49.27)).toBe(22);
  });

  it('deve retornar zona 25 para Recife (-34.87)', () => {
    expect(getUTMZone(-34.87)).toBe(25);
  });
});

describe('getSIRGASEPSG', () => {
  it('deve retornar EPSG correto para zona 23 sul', () => {
    expect(getSIRGASEPSG(23, true)).toBe(31983);
  });

  it('deve retornar EPSG correto para zona 22 sul', () => {
    expect(getSIRGASEPSG(22, true)).toBe(31982);
  });
});

describe('isValidBrazilCoordinate', () => {
  it('Brasilia deve ser coordenada valida', () => {
    expect(isValidBrazilCoordinate(-47.93, -15.78)).toBe(true);
  });

  it('Sao Paulo deve ser coordenada valida', () => {
    expect(isValidBrazilCoordinate(-46.63, -23.55)).toBe(true);
  });

  it('Manaus deve ser coordenada valida', () => {
    expect(isValidBrazilCoordinate(-60.02, -3.12)).toBe(true);
  });

  it('Nova York nao deve ser coordenada valida do Brasil', () => {
    expect(isValidBrazilCoordinate(-74.0, 40.7)).toBe(false);
  });

  it('Londres nao deve ser coordenada valida do Brasil', () => {
    expect(isValidBrazilCoordinate(-0.1, 51.5)).toBe(false);
  });
});

describe('geographicToSIRGASUTM / sirgasUTMToGeographic (round-trip)', () => {
  const testPoints: [number, number][] = [
    [-47.93, -15.78],   // Brasilia
    [-46.63, -23.55],   // Sao Paulo
    [-43.17, -22.91],   // Rio de Janeiro
    [-49.27, -25.43],   // Curitiba
    [-38.52, -12.97],   // Salvador
  ];

  testPoints.forEach(([lon, lat]) => {
    it(`round-trip para [${lon}, ${lat}]`, () => {
      const zone = getUTMZone(lon);
      const [easting, northing] = geographicToSIRGASUTM(lon, lat, zone);

      // UTM easting deve estar entre 100000 e 900000
      expect(easting).toBeGreaterThan(100000);
      expect(easting).toBeLessThan(900000);

      // Northing deve ser positivo (com 10M offset para sul)
      expect(northing).toBeGreaterThan(0);

      // Round-trip: converter de volta para geografico
      const [lonBack, latBack] = sirgasUTMToGeographic(easting, northing, zone, true);
      expect(lonBack).toBeCloseTo(lon, 5);
      expect(latBack).toBeCloseTo(lat, 5);
    });
  });
});

describe('toDMS', () => {
  it('deve formatar latitude sul corretamente', () => {
    const dms = toDMS(-15.78, true);
    expect(dms).toContain('15');
    expect(dms).toContain('S');
    expect(dms).toContain('°');
  });

  it('deve formatar longitude oeste corretamente', () => {
    const dms = toDMS(-47.93, false);
    expect(dms).toContain('47');
    expect(dms).toContain('W');
    expect(dms).toContain('°');
  });

  it('deve formatar latitude norte com N', () => {
    const dms = toDMS(3.5, true);
    expect(dms).toContain('N');
  });

  it('deve formatar longitude leste com E', () => {
    const dms = toDMS(10.0, false);
    expect(dms).toContain('E');
  });
});

describe('fromDMS', () => {
  it('deve parsear DMS de latitude sul', () => {
    const result = fromDMS('15°46\'48.0000" S');
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(-15.78, 1);
  });

  it('deve parsear DMS de longitude oeste', () => {
    const result = fromDMS('47°55\'48.0000" W');
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(-47.93, 1);
  });

  it('deve retornar null para formato invalido', () => {
    expect(fromDMS('lixo')).toBeNull();
    expect(fromDMS('')).toBeNull();
    expect(fromDMS('123')).toBeNull();
  });

  it('round-trip toDMS -> fromDMS', () => {
    const original = -15.78;
    const dms = toDMS(original, true);
    const back = fromDMS(dms);
    expect(back).not.toBeNull();
    expect(back!).toBeCloseTo(original, 3);
  });
});
