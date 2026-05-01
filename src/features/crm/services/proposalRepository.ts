import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Proposal } from '@/src/types';
import { SupabaseRepository } from '@/src/services/shared/supabaseRepository';
import { toIsoString } from '@/src/services/shared/mappers';

type ProposalRecord = {
  id: string;
  organization_id: string;
  client_id: string;
  title: string;
  value: number;
  status: Proposal['status'];
  description?: string | null;
  valid_until: string;
  public_token?: string | null;
  created_at: string;
  updated_at: string;
};

const proposalRecordSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  client_id: z.string().uuid(),
  title: z.string(),
  value: z.coerce.number(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected']),
  description: z.string().nullable(),
  valid_until: z.string(),
  public_token: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

function mapProposalRecord(record: ProposalRecord): Proposal {
  return {
    id: record.id,
    clientId: record.client_id,
    title: record.title,
    value: Number(record.value),
    status: record.status,
    description: record.description ?? undefined,
    validUntil: toIsoString(record.valid_until),
    createdAt: toIsoString(record.created_at),
    updatedAt: toIsoString(record.updated_at),
    publicToken: record.public_token ?? undefined,
  };
}

export class SupabaseProposalRepository extends SupabaseRepository {
  constructor(supabase: SupabaseClient, organizationId: string) {
    super(supabase, organizationId);
  }

  async listProposals() {
    const rows = await this.unwrap(
      this.supabase
        .from('proposals')
        .select('*')
        .eq('organization_id', this.organizationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      'Nao foi possivel carregar as propostas.',
    );

    return proposalRecordSchema.array().parse(rows).map(mapProposalRecord);
  }

  async createProposal(proposal: Omit<Proposal, 'id' | 'createdAt' | 'updatedAt'>) {
    await this.unwrap(
      this.supabase
        .from('proposals')
        .insert({
          organization_id: this.organizationId,
          client_id: proposal.clientId,
          title: proposal.title,
          value: proposal.value,
          status: proposal.status,
          description: proposal.description ?? null,
          valid_until: toIsoString(proposal.validUntil),
        })
        .select('id'),
      'Nao foi possivel criar a proposta.',
    );
  }

  async updateProposal(id: string, data: Partial<Proposal>) {
    const shouldAutoCreateTransaction = data.status === 'accepted';
    let currentProposal: ProposalRecord | null = null;

    if (shouldAutoCreateTransaction) {
      const proposalRows = await this.unwrap(
        this.supabase
          .from('proposals')
          .select('*')
          .eq('organization_id', this.organizationId)
          .eq('id', id)
          .limit(1),
        'Nao foi possivel localizar a proposta.',
      );

      currentProposal = proposalRecordSchema.array().parse(proposalRows)[0] ?? null;
    }

    const payload: Record<string, unknown> = {};

    if (data.clientId !== undefined) payload.client_id = data.clientId;
    if (data.title !== undefined) payload.title = data.title;
    if (data.value !== undefined) payload.value = data.value;
    if (data.status !== undefined) payload.status = data.status;
    if (data.description !== undefined) payload.description = data.description ?? null;
    if (data.validUntil !== undefined) payload.valid_until = toIsoString(data.validUntil);

    await this.unwrap(
      this.supabase
        .from('proposals')
        .update(payload)
        .eq('organization_id', this.organizationId)
        .eq('id', id)
        .select('id'),
      'Nao foi possivel atualizar a proposta.',
    );

    if (shouldAutoCreateTransaction && currentProposal) {
      const description = `Proposta Aceita: ${currentProposal.title}`;

      const existingRows = await this.unwrap(
        this.supabase
          .from('transactions')
          .select('id')
          .eq('organization_id', this.organizationId)
          .eq('description', description)
          .eq('client_id', currentProposal.client_id)
          .is('deleted_at', null)
          .limit(1),
        'Nao foi possivel verificar os lancamentos da proposta.',
      );

      const existingTransaction = (existingRows as { id: string }[])[0];

      if (!existingTransaction) {
        const now = new Date();
        const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        await this.unwrap(
          this.supabase
            .from('transactions')
            .insert({
              organization_id: this.organizationId,
              type: 'income',
              amount: currentProposal.value,
              description,
              date: now.toISOString(),
              due_date: dueDate.toISOString(),
              status: 'pending',
              category_id: 'Vendas',
              client_id: currentProposal.client_id,
            })
            .select('id'),
          'Nao foi possivel gerar o lancamento da proposta aceita.',
        );
      }
    }
  }
}

export function createProposalRepository(supabase: SupabaseClient, organizationId: string) {
  return new SupabaseProposalRepository(supabase, organizationId);
}
