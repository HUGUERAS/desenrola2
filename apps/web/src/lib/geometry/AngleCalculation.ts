/**
 * AngleCalculation: Calculo de angulo e azimute
 * Usado pelas ferramentas de medicao angular
 */

/**
 * Calculate angle between three points (in degrees)
 * @param p1 First point [lon, lat]
 * @param vertex Vertex point [lon, lat]
 * @param p2 Last point [lon, lat]
 * @returns Angle in degrees (0-360)
 */
export function calculateAngle(
  p1: [number, number],
  vertex: [number, number],
  p2: [number, number]
): number {
  const [x1, y1] = p1;
  const [vx, vy] = vertex;
  const [x2, y2] = p2;

  const angle1 = Math.atan2(y1 - vy, x1 - vx);
  const angle2 = Math.atan2(y2 - vy, x2 - vx);

  let angle = (angle2 - angle1) * (180 / Math.PI);
  if (angle < 0) angle += 360;

  return angle;
}

/**
 * Calculate azimuth (bearing) from point1 to point2
 * @param p1 Start point [lon, lat]
 * @param p2 End point [lon, lat]
 * @returns Azimuth in degrees (0-360), where 0 = North
 */
export function calculateAzimuth(
  p1: [number, number],
  p2: [number, number]
): number {
  const [lon1, lat1] = p1;
  const [lon2, lat2] = p2;

  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let azimuth = Math.atan2(y, x) * (180 / Math.PI);
  azimuth = (azimuth + 360) % 360;

  return azimuth;
}

/**
 * Calculate internal angle of a polygon at a specific vertex index
 */
export function calculateInternalAngle(
  ring: number[][],
  vertexIndex: number
): number {
  const n = ring.length - 1;
  const prevIdx = vertexIndex === 0 ? n - 1 : vertexIndex - 1;
  const nextIdx = (vertexIndex + 1) % n;

  return calculateAngle(
    [ring[prevIdx][0], ring[prevIdx][1]],
    [ring[vertexIndex][0], ring[vertexIndex][1]],
    [ring[nextIdx][0], ring[nextIdx][1]]
  );
}
