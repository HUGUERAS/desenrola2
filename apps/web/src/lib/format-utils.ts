/**
 * Utilitários de formatação para campos brasileiros
 * Usados em MeusDadosPanel, ConfrontacoesPanel, LotesPanel
 */

export function formatCPF(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
        return numbers
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})/, '$1-$2')
            .replace(/(-\d{2})\d+?$/, '$1');
    }

    return numbers
        .slice(0, 14)
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function isValidCpfCnpj(value: string): boolean {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 11) return isValidCPF(digits);
    if (digits.length === 14) return isValidCNPJ(digits);
    return false;
}

function isValidCPF(cpfDigits: string): boolean {
    if (!cpfDigits || cpfDigits.length !== 11 || /^(\d)\1+$/.test(cpfDigits)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i += 1) sum += Number(cpfDigits[i]) * (10 - i);
    let checker = 11 - (sum % 11);
    if (checker >= 10) checker = 0;
    if (checker !== Number(cpfDigits[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i += 1) sum += Number(cpfDigits[i]) * (11 - i);
    checker = 11 - (sum % 11);
    if (checker >= 10) checker = 0;

    return checker === Number(cpfDigits[10]);
}

function isValidCNPJ(cnpjDigits: string): boolean {
    if (!cnpjDigits || cnpjDigits.length !== 14 || /^(\d)\1+$/.test(cnpjDigits)) return false;

    const calcCheckDigit = (base: string, weights: number[]) => {
        const sum = base.split('').reduce((acc, digit, idx) => acc + Number(digit) * weights[idx], 0);
        const remainder = sum % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    };

    const firstBase = cnpjDigits.slice(0, 12);
    const firstDigit = calcCheckDigit(firstBase, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    if (firstDigit !== Number(cnpjDigits[12])) return false;

    const secondBase = cnpjDigits.slice(0, 13);
    const secondDigit = calcCheckDigit(secondBase, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return secondDigit === Number(cnpjDigits[13]);
}

export function formatPhone(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
        return numbers
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .replace(/(-\d{4})\d+?$/, '$1');
    }
    return value;
}

export function formatCEP(value: string): string {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 8) {
        return numbers.replace(/(\d{5})(\d)/, '$1-$2').replace(/(-\d{3})\d+?$/, '$1');
    }
    return value;
}
