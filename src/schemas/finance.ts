import { z } from 'zod';
import { isoDateStringSchema, nonEmptyStringSchema } from './common';

export const transactionTypeSchema = z.enum(['income', 'expense']);
export const transactionStatusSchema = z.enum(['pending', 'liquidated', 'cancelled']);
export const recurrenceIntervalSchema = z.enum(['monthly', 'weekly', 'yearly']);

export const transactionFormSchema = z.object({
  type: transactionTypeSchema,
  amount: z.coerce.number().positive('Informe um valor maior que zero.'),
  description: nonEmptyStringSchema,
  date: isoDateStringSchema,
  dueDate: isoDateStringSchema,
  status: transactionStatusSchema,
  categoryId: nonEmptyStringSchema,
  costCenterId: z.string().trim().optional(),
  clientId: z.string().trim().optional(),
  projectId: z.string().trim().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceInterval: recurrenceIntervalSchema.optional(),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
