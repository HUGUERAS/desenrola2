import { describe, it, expect } from 'vitest';
import { parseGeoFile } from '../file-parsers';

// Helper para criar File fake
function createFile(content: string, name: string, type = 'application/json'): File {
  return new File([content], name, { type });
}

describe('parseGeoFile', () => {
  it('deve parsear GeoJSON Polygon', async () => {
    const geojson = JSON.stringify({
      type: 'Polygon',
      coordinates: [[[-47.93, -15.78], [-47.929, -15.78], [-47.929, -15.779], [-47.93, -15.78]]],
    });
    const file = createFile(geojson, 'teste.geojson');
    const result = await parseGeoFile(file);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('Polygon');
  });

  it('deve parsear GeoJSON Feature', async () => {
    const geojson = JSON.stringify({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-47.93, -15.78], [-47.929, -15.78], [-47.929, -15.779], [-47.93, -15.78]]],
      },
      properties: { nome: 'Lote 1' },
    });
    const file = createFile(geojson, 'teste.geojson');
    const result = await parseGeoFile(file);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('Polygon');
  });

  it('deve parsear GeoJSON FeatureCollection', async () => {
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[[-47.93, -15.78], [-47.929, -15.78], [-47.929, -15.779], [-47.93, -15.78]]],
          },
          properties: {},
        },
      ],
    });
    const file = createFile(geojson, 'teste.json');
    const result = await parseGeoFile(file);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('Polygon');
  });

  it('deve parsear arquivo KML (requer DOMParser do browser)', async () => {
    // DOMParser nao disponivel no Node.js, testar apenas no browser
    const hasDOMParser = typeof globalThis.DOMParser !== 'undefined';
    if (!hasDOMParser) {
      // No Node/Vitest, parseKML retorna null pois DOMParser nao existe
      const kml = '<kml><Document></Document></kml>';
      const file = createFile(kml, 'teste.kml');
      const result = await parseGeoFile(file);
      expect(result).toBeNull();
      return;
    }

    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -47.93,-15.78,0
              -47.929,-15.78,0
              -47.929,-15.779,0
              -47.93,-15.779,0
              -47.93,-15.78,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;
    const file = createFile(kml, 'teste.kml', 'application/vnd.google-earth.kml+xml');
    const result = await parseGeoFile(file);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('Polygon');
    expect(result!.coordinates[0].length).toBe(5);
  });

  it('deve retornar null para DXF (requer backend)', async () => {
    const file = createFile('DXF content', 'teste.dxf');
    const result = await parseGeoFile(file);
    expect(result).toBeNull();
  });

  it('deve retornar null para formato desconhecido', async () => {
    const file = createFile('random content', 'teste.xyz');
    const result = await parseGeoFile(file);
    expect(result).toBeNull();
  });

  it('deve retornar null para GeoJSON invalido', async () => {
    const file = createFile('nao e json', 'teste.geojson');
    const result = await parseGeoFile(file);
    expect(result).toBeNull();
  });
});
