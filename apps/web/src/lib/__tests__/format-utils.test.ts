import { describe, expect, it } from 'vitest';
import { formatCPF, isValidCpfCnpj } from '../format-utils';

describe('format-utils', () => {
  it('formata CPF', () => {
    expect(formatCPF('12345678901')).toBe('123.456.789-01');
  });

  it('formata CNPJ', () => {
    expect(formatCPF('12345678000195')).toBe('12.345.678/0001-95');
  });

  it('valida CPF e CNPJ', () => {
    expect(isValidCpfCnpj('529.982.247-25')).toBe(true);
    expect(isValidCpfCnpj('04.252.011/0001-10')).toBe(true);
    expect(isValidCpfCnpj('111.111.111-11')).toBe(false);
    expect(isValidCpfCnpj('00.000.000/0000-00')).toBe(false);
  });
});
