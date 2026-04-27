import { z } from 'zod';

export const pendingNavigationIntentSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('open-project'), projectId: z.string().min(1) }),
  z.object({ kind: z.literal('create-project') }),
  z.object({ kind: z.literal('open-client'), clientId: z.string().min(1) }),
  z.object({ kind: z.literal('create-client') }),
  z.object({ kind: z.literal('create-transaction'), timestamp: z.number().finite().optional() }),
  z.object({ kind: z.literal('upload-document') }),
]);

export type PendingNavigationIntent = z.infer<typeof pendingNavigationIntentSchema>;
