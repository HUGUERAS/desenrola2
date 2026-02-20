/**
 * file-parsers.ts — Parsers de arquivos geoespaciais
 * Suporta: GeoJSON, KML, KMZ
 */

/**
 * Parse geo file based on extension
 */
export async function parseGeoFile(file: File): Promise<Record<string, any> | null> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.geojson') || name.endsWith('.json')) {
    return parseGeoJSON(file);
  }

  if (name.endsWith('.kml')) {
    return parseKML(file);
  }

  if (name.endsWith('.kmz')) {
    return parseKMZ(file);
  }

  // DXF - requires backend
  if (name.endsWith('.dxf')) {
    return null; // Handled via backend API
  }

  return null;
}

/**
 * Parse GeoJSON file
 */
async function parseGeoJSON(file: File): Promise<Record<string, any> | null> {
  try {
    const text = await file.text();
    const json = JSON.parse(text);

    // Validate it's valid GeoJSON
    if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
      // Extract first polygon geometry
      const feature = json.features.find(
        (f: any) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
      );
      return feature?.geometry || json;
    }

    if (json.type === 'Feature' && json.geometry) {
      return json.geometry;
    }

    if (json.type === 'Polygon' || json.type === 'MultiPolygon') {
      return json;
    }

    return json;
  } catch {
    return null;
  }
}

/**
 * Parse KML file to GeoJSON geometry
 */
async function parseKML(file: File): Promise<Record<string, any> | null> {
  try {
    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');

    // Find coordinates in Polygon
    const coordsElements = doc.querySelectorAll('coordinates');
    if (coordsElements.length === 0) return null;

    const coordinates: number[][] = [];

    // Parse first coordinates element (main polygon)
    const coordsText = coordsElements[0].textContent?.trim();
    if (!coordsText) return null;

    const coordPairs = coordsText.split(/\s+/);
    for (const pair of coordPairs) {
      const parts = pair.split(',').map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        coordinates.push([parts[0], parts[1]]);
      }
    }

    if (coordinates.length < 3) return null;

    // Ensure ring is closed
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coordinates.push([...first]);
    }

    return {
      type: 'Polygon',
      coordinates: [coordinates],
    };
  } catch {
    return null;
  }
}

/**
 * Parse KMZ file (ZIP containing KML)
 */
async function parseKMZ(file: File): Promise<Record<string, any> | null> {
  try {
    // KMZ is a ZIP file - use JSZip if available, otherwise try as KML
    const arrayBuffer = await file.arrayBuffer();

    // Try to decompress using DecompressionStream (modern browsers)
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const blob = new Blob([arrayBuffer]);
        const ds = new DecompressionStream('deflate');
        const stream = blob.stream().pipeThrough(ds);
        const decompressed = await new Response(stream).text();
        const kmlFile = new File([decompressed], 'doc.kml');
        return parseKML(kmlFile);
      } catch {
        // Fallback: treat as plain KML
      }
    }

    // Fallback: try parsing as plain text KML
    const text = new TextDecoder().decode(arrayBuffer);
    if (text.includes('<kml') || text.includes('<coordinates')) {
      const kmlFile = new File([text], 'doc.kml');
      return parseKML(kmlFile);
    }

    return null;
  } catch {
    return null;
  }
}
