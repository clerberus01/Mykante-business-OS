import { z } from 'zod';

export const isoDateStringSchema = z
  .string()
  .min(1)
  .refine((value) => Number.isFinite(new Date(value).getTime()), 'Data invalida.');

export const uuidSchema = z.string().uuid();

export const optionalUuidSchema = z
  .string()
  .trim()
  .transform((value) => (value ? value : undefined))
  .pipe(uuidSchema.optional());

export const nonEmptyStringSchema = z.string().trim().min(1, 'Campo obrigatorio.');
