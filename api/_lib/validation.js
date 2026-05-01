import { z } from 'zod';
import { readJsonBody } from './request.js';

export const uuidSchema = z.string().trim().uuid();
export const emailSchema = z.string().trim().email().max(320);

export const publicStatusRequestSchema = z.object({
  token: uuidSchema,
  email: emailSchema,
});

export const privacyRequestSchema = z.object({
  requestType: z.enum(['confirm', 'access', 'correction', 'portability', 'anonymization', 'deletion', 'revocation']),
  requestDetails: z.string().trim().max(4000).nullable().optional(),
});

export const whatsappSendSchema = z.object({
  conversationId: uuidSchema,
  body: z.string().trim().max(4096).optional(),
  templateKey: z.string().trim().min(1).max(120).optional(),
}).refine((value) => Boolean(value.body || value.templateKey), {
  message: 'body or templateKey is required.',
  path: ['body'],
});

export const testNotificationSchema = z.object({
  test: z.literal(true).optional(),
});

export const mobileQrConsumeSchema = z.object({
  code: z.string().trim().min(32).max(256),
  location: z.record(z.string(), z.unknown()).optional(),
});

export async function readValidatedJsonBody(request, schema) {
  const body = await readJsonBody(request);
  const result = schema.safeParse(body);

  if (!result.success) {
    const error = new Error('Invalid request body.');
    error.statusCode = 400;
    error.details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw error;
  }

  return result.data;
}

export function getValidationErrorPayload(error, fallbackMessage = 'Invalid request body.') {
  return {
    error: error instanceof Error ? error.message : fallbackMessage,
    details: Array.isArray(error?.details) ? error.details : undefined,
  };
}
