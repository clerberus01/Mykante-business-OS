import { z } from 'zod';
import { isoDateStringSchema, nonEmptyStringSchema } from './common';

export const projectStatusSchema = z.enum(['draft', 'ongoing', 'paused', 'completed', 'cancelled']);
export const paymentStatusSchema = z.enum(['paid', 'pending', 'overdue']);

export const projectFormSchema = z
  .object({
    name: nonEmptyStringSchema,
    clientId: nonEmptyStringSchema,
    description: z.string().trim(),
    status: projectStatusSchema,
    startDate: isoDateStringSchema,
    deadline: isoDateStringSchema,
    budget: z.coerce.number().min(0),
    paymentStatus: paymentStatusSchema,
    templateId: z.string().trim().optional(),
  })
  .refine((value) => new Date(value.deadline).getTime() >= new Date(value.startDate).getTime(), {
    message: 'O prazo deve ser igual ou posterior ao inicio.',
    path: ['deadline'],
  });

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
