/**
 * CoordinateConversion: Conversao de coordenadas
 * SIRGAS 2000, UTM, Geographic (WGS84)
 */

/**
 * Convert Geographic (EPSG:4326) to SIRGAS 2000 / UTM
 */
export function geographicToSIRGASUTM(
  lon: number,
  lat: number,
  zone?: number
): [number, number] {
  const utmZone = zone ?? getUTMZone(lon);
  const centralMeridian = (utmZone - 1) * 6 - 180 + 3;

  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const k0 = 0.9996;

  const e = Math.sqrt(2 * f - f * f);
  const e2 = e * e;
  const ep2 = e2 / (1 - e2);

  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  const centralMeridianRad = centralMeridian * Math.PI / 180;

  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) ** 2);
  const T = Math.tan(latRad) ** 2;
  const C = ep2 * Math.cos(latRad) ** 2;
  const A = Math.cos(latRad) * (lonRad - centralMeridianRad);

  const M = a * (
    (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * latRad -
    (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * latRad) +
    (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * latRad) -
    (35 * e2 ** 3 / 3072) * Math.sin(6 * latRad)
  );

  let easting = k0 * N * (
    A + (1 - T + C) * A ** 3 / 6 +
    (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120
  ) + 500000;

  let northing = k0 * (
    M + N * Math.tan(latRad) * (
      A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24 +
      (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720
    )
  );

  if (lat < 0) northing += 10000000;

  return [easting, northing];
}

/**
 * Convert SIRGAS 2000 UTM to Geographic (WGS84)
 */
export function sirgasUTMToGeographic(
  easting: number,
  northing: number,
  zone: number,
  southern: boolean = true
): [number, number] {
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const k0 = 0.9996;

  const e = Math.sqrt(2 * f - f * f);
  const e2 = e * e;
  const ep2 = e2 / (1 - e2);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const centralMeridian = (zone - 1) * 6 - 180 + 3;

  const x = easting - 500000;
  const y = southern ? northing - 10000000 : northing;

  const M0 = y / k0;
  const mu = M0 / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));

  const phi1 = mu +
    (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) +
    (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) +
    (151 * e1 ** 3 / 96) * Math.sin(6 * mu);

  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) ** 2);
  const T1 = Math.tan(phi1) ** 2;
  const C1 = ep2 * Math.cos(phi1) ** 2;
  const R1 = a * (1 - e2) / (1 - e2 * Math.sin(phi1) ** 2) ** 1.5;
  const D = x / (N1 * k0);

  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
    D ** 2 / 2 -
    (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4 / 24 +
    (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6 / 720
  );

  const lon = (
    D - (1 + 2 * T1 + C1) * D ** 3 / 6 +
    (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5 / 120
  ) / Math.cos(phi1);

  return [
    centralMeridian + lon * (180 / Math.PI),
    lat * (180 / Math.PI)
  ];
}

/** Detect UTM zone from longitude */
export function getUTMZone(lon: number): number {
  return Math.floor((lon + 180) / 6) + 1;
}

/** Get EPSG code for SIRGAS 2000 UTM zone */
export function getSIRGASEPSG(zone: number, southern: boolean = true): number {
  return southern ? 31960 + zone : 31954 + zone;
}

/** Validate if coordinates are within Brazil bounds */
export function isValidBrazilCoordinate(lon: number, lat: number): boolean {
  return lon >= -75 && lon <= -34 && lat >= -34 && lat <= 6;
}

/** Format coordinate in DMS (Degrees Minutes Seconds) */
export function toDMS(decimal: number, isLat: boolean): string {
  const direction = isLat
    ? (decimal >= 0 ? 'N' : 'S')
    : (decimal >= 0 ? 'E' : 'W');

  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;

  return `${degrees}\u00B0${minutes}'${seconds.toFixed(4)}" ${direction}`;
}

/** Parse DMS string to decimal degrees */
export function fromDMS(dms: string): number | null {
  const match = dms.match(/(\d+)\s*[°]\s*(\d+)\s*['']\s*([\d.]+)\s*[""]\s*([NSEW])/i);
  if (!match) return null;

  const degrees = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const seconds = parseFloat(match[3]);
  const direction = match[4].toUpperCase();

  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (direction === 'S' || direction === 'W') decimal = -decimal;

  return decimal;
}
