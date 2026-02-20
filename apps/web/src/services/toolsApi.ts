/**
 * toolsApi.ts — API client for geo tools backend endpoints
 * Import/Export e SIGEF
 */

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token') || '';
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || `API Error ${response.status}`);
  }

  return response.json();
}

async function apiUpload<T>(path: string, file: File): Promise<T> {
  const token = localStorage.getItem('auth_token') || '';
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || `API Error ${response.status}`);
  }

  return response.json();
}

async function apiDownload(path: string, body: object, filename: string): Promise<void> {
  const token = localStorage.getItem('auth_token') || '';
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || `API Error ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── SIGEF ──

export interface SIGEFValidationResult {
  valido: boolean;
  erros: string[];
  avisos: string[];
}

export async function validateSIGEF(
  geomWkt: string,
  areaHectares: number,
  verticesSirgas: number[][],
): Promise<SIGEFValidationResult> {
  return apiRequest('/api/sigef/validar', {
    method: 'POST',
    body: JSON.stringify({ geom_wkt: geomWkt, area_hectares: areaHectares, vertices_sirgas: verticesSirgas }),
  });
}

export async function generateMemorial(
  vertices: number[][],
  areaM2: number,
  confrontantes?: Record<string, string>,
): Promise<{ memorial: string; tabela: string }> {
  return apiRequest('/api/sigef/memorial', {
    method: 'POST',
    body: JSON.stringify({ vertices, area_m2: areaM2, confrontantes }),
  });
}

export async function getVerticesSIRGAS(
  vertices: number[][],
): Promise<{ tabela: string }> {
  return apiRequest('/api/sigef/vertices-sirgas', {
    method: 'POST',
    body: JSON.stringify({ vertices }),
  });
}

// ── Import ──

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: string; coordinates: unknown };
    properties: Record<string, unknown>;
  }>;
}

export async function importKML(file: File): Promise<GeoJSONFeatureCollection> {
  return apiUpload('/api/import-export/import/kml', file);
}

export async function importGeoJSON(file: File): Promise<GeoJSONFeatureCollection> {
  return apiUpload('/api/import-export/import/geojson', file);
}

// ── Export ──

export async function exportDXF(geometries: object[]): Promise<void> {
  return apiDownload('/api/import-export/export/dxf', { geometries }, 'export.dxf');
}

export async function exportGeoJSON(geometry: object): Promise<void> {
  return apiDownload('/api/import-export/export/geojson', { geometry }, 'export.geojson');
}
