import { describe, it, expect } from 'vitest';
import {
  calculateAngle,
  calculateAzimuth,
  calculateInternalAngle,
} from '../geometry/AngleCalculation';

describe('calculateAngle', () => {
  it('deve retornar 90 graus para angulo reto', () => {
    const p1: [number, number] = [1, 0];
    const vertex: [number, number] = [0, 0];
    const p2: [number, number] = [0, 1];
    const angle = calculateAngle(p1, vertex, p2);
    expect(angle).toBeCloseTo(90, 0);
  });

  it('deve retornar 180 graus para angulo raso', () => {
    const p1: [number, number] = [-1, 0];
    const vertex: [number, number] = [0, 0];
    const p2: [number, number] = [1, 0];
    const angle = calculateAngle(p1, vertex, p2);
    expect(angle).toBeCloseTo(180, 0);
  });

  it('deve retornar angulo entre 0 e 360', () => {
    const p1: [number, number] = [1, 0];
    const vertex: [number, number] = [0, 0];
    const p2: [number, number] = [0, -1];
    const angle = calculateAngle(p1, vertex, p2);
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThanOrEqual(360);
  });

  it('deve retornar 0 quando P1 e P2 sao o mesmo ponto', () => {
    const p1: [number, number] = [1, 0];
    const vertex: [number, number] = [0, 0];
    const angle = calculateAngle(p1, vertex, p1);
    expect(angle).toBeCloseTo(0, 0);
  });
});

describe('calculateAzimuth', () => {
  it('deve retornar ~0 para direcao Norte', () => {
    const p1: [number, number] = [-47.93, -15.78];
    const p2: [number, number] = [-47.93, -15.77]; // norte
    const azimuth = calculateAzimuth(p1, p2);
    expect(azimuth).toBeCloseTo(0, 0);
  });

  it('deve retornar ~90 para direcao Leste', () => {
    const p1: [number, number] = [-47.93, -15.78];
    const p2: [number, number] = [-47.92, -15.78]; // leste
    const azimuth = calculateAzimuth(p1, p2);
    expect(azimuth).toBeCloseTo(90, 0);
  });

  it('deve retornar ~180 para direcao Sul', () => {
    const p1: [number, number] = [-47.93, -15.78];
    const p2: [number, number] = [-47.93, -15.79]; // sul
    const azimuth = calculateAzimuth(p1, p2);
    expect(azimuth).toBeCloseTo(180, 0);
  });

  it('deve retornar ~270 para direcao Oeste', () => {
    const p1: [number, number] = [-47.93, -15.78];
    const p2: [number, number] = [-47.94, -15.78]; // oeste
    const azimuth = calculateAzimuth(p1, p2);
    expect(azimuth).toBeCloseTo(270, 0);
  });

  it('azimute deve estar entre 0 e 360', () => {
    const p1: [number, number] = [-47.93, -15.78];
    const p2: [number, number] = [-47.925, -15.775];
    const azimuth = calculateAzimuth(p1, p2);
    expect(azimuth).toBeGreaterThanOrEqual(0);
    expect(azimuth).toBeLessThan(360);
  });
});

describe('calculateInternalAngle', () => {
  it('deve calcular angulos internos de um quadrado', () => {
    const square = [
      [-47.93, -15.78],
      [-47.929, -15.78],
      [-47.929, -15.779],
      [-47.93, -15.779],
      [-47.93, -15.78], // fechado
    ];

    // Cada angulo de um quadrado deve ser ~90 ou ~270 (depende do sentido)
    const angle = calculateInternalAngle(square, 0);
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThan(360);
  });

  it('deve funcionar com indices de borda (primeiro e ultimo vertice)', () => {
    const triangle = [
      [0, 0],
      [1, 0],
      [0.5, 1],
      [0, 0], // fechado
    ];

    const angle0 = calculateInternalAngle(triangle, 0);
    const angle1 = calculateInternalAngle(triangle, 1);
    const angle2 = calculateInternalAngle(triangle, 2);

    // Todos devem ser positivos
    expect(angle0).toBeGreaterThan(0);
    expect(angle1).toBeGreaterThan(0);
    expect(angle2).toBeGreaterThan(0);
  });
});
