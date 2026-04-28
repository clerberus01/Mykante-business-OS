import { z } from 'zod';

const onlyDigits = (value: string) => value.replace(/\D/g, '');

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  const calc = (base: string, factor: number) => {
    const total = base.split('').reduce((sum, digit) => sum + Number(digit) * factor--, 0);
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return calc(cpf.slice(0, 9), 10) === Number(cpf[9]) && calc(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

export function isValidCnpj(value: string) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;

  const calc = (base: string, factors: number[]) => {
    const total = base.split('').reduce((sum, digit, index) => sum + Number(digit) * factors[index], 0);
    const rest = total % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const first = calc(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calc(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(cnpj[12]) && second === Number(cnpj[13]);
}

function isCompanyPersonType(value: string) {
  const normalized = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return normalized.includes('jur') || normalized.includes('dica');
}

export const clientQuickCreateSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cliente.'),
  phone: z.string().trim().min(8, 'Informe um telefone valido.'),
  email: z.string().trim().email('Informe um email valido.').or(z.literal('')).optional(),
  taxId: z.string().trim().optional(),
  whatsappOptIn: z.boolean().default(true),
  source: z.enum(['web', 'mobile', 'whatsapp', 'import']).default('web'),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export const clientDocumentSchema = z.object({
  personType: z.string().trim().min(1),
  taxId: z.string().trim().optional(),
}).superRefine((value, context) => {
  if (!value.taxId) return;

  const isCompany = isCompanyPersonType(value.personType);
  const valid = isCompany ? isValidCnpj(value.taxId) : isValidCpf(value.taxId);

  if (!valid) {
    context.addIssue({
      code: 'custom',
      path: ['taxId'],
      message: isCompany ? 'CNPJ invalido.' : 'CPF invalido.',
    });
  }
});
