import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Client, CrmDeal, CrmPipelineStage, TimelineEvent } from '../../types';
import { SupabaseRepository } from '../shared/supabaseRepository';
import { DataLayerError } from '../shared/dataErrors';
import { normalizeStringArray, toIsoString } from '../shared/mappers';

type ClientRecord = {
  id: string;
  organization_id: string;
  person_type: 'individual' | 'company';
  name: string;
  tax_id: string;
  email: string;
  phone: string;
  company: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: Client['status'];
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_zip_code: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  due_day: number | null;
  pix_key: string | null;
  banking_info: string | null;
  tags: string[] | null;
  attention: string | null;
  origin: string | null;
  public_token?: string | null;
  public_status_enabled?: boolean | null;
  public_status_closed_at?: string | null;
  created_at: string;
  updated_at: string;
};

type ClientEventRecord = {
  id: string;
  organization_id: string;
  client_id: string;
  type: TimelineEvent['type'];
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
};

type PipelineStageRecord = {
  id: string;
  organization_id: string;
  key: string;
  name: string;
  position: number;
  color: string | null;
  is_default: boolean;
};

type DealRecord = {
  id: string;
  organization_id: string;
  client_id: string;
  stage_id: string;
  title: string;
  value: number | null;
  probability: number;
  status: CrmDeal['status'];
  expected_close_at: string | null;
  created_at: string;
  updated_at: string;
};

const clientRecordSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  person_type: z.enum(['individual', 'company']),
  name: z.string(),
  tax_id: z.string(),
  email: z.string(),
  phone: z.string(),
  company: z.string().nullable(),
  contact_name: z.string().nullable(),
  contact_role: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_phone: z.string().nullable(),
  status: z.enum(['active', 'inactive', 'archived', 'lead']),
  address_street: z.string().nullable(),
  address_number: z.string().nullable(),
  address_complement: z.string().nullable(),
  address_zip_code: z.string().nullable(),
  address_neighborhood: z.string().nullable(),
  address_city: z.string().nullable(),
  address_state: z.string().nullable(),
  due_day: z.number().nullable(),
  pix_key: z.string().nullable(),
  banking_info: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  attention: z.string().nullable(),
  origin: z.string().nullable(),
  public_token: z.string().uuid().nullable().optional(),
  public_status_enabled: z.boolean().nullable().optional(),
  public_status_closed_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

const clientEventRecordSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  client_id: z.string().uuid(),
  type: z.enum(['email', 'whatsapp', 'note', 'file', 'system']),
  title: z.string(),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
  created_by: z.string().nullable(),
});

const pipelineStageRecordSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  position: z.number(),
  color: z.string().nullable(),
  is_default: z.boolean(),
});

const dealRecordSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  client_id: z.string().uuid(),
  stage_id: z.string().uuid(),
  title: z.string(),
  value: z.coerce.number().nullable(),
  probability: z.number(),
  status: z.enum(['open', 'won', 'lost']),
  expected_close_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

function mapClientRecord(record: ClientRecord): Client {
  return {
    id: record.id,
    personType: record.person_type === 'company' ? 'Jurídica' : 'Física',
    name: record.name,
    taxId: record.tax_id,
    email: record.email,
    phone: record.phone,
    company: record.company ?? undefined,
    contactName: record.contact_name ?? undefined,
    contactRole: record.contact_role ?? undefined,
    contactEmail: record.contact_email ?? undefined,
    contactPhone: record.contact_phone ?? undefined,
    status: record.status,
    address: {
      street: record.address_street ?? '',
      number: record.address_number ?? '',
      complement: record.address_complement ?? undefined,
      zipCode: record.address_zip_code ?? '',
      neighborhood: record.address_neighborhood ?? '',
      city: record.address_city ?? '',
      state: record.address_state ?? '',
    },
    dueDay: record.due_day ?? 1,
    pixKey: record.pix_key ?? undefined,
    bankingInfo: record.banking_info ?? undefined,
    tags: normalizeStringArray(record.tags),
    attention: record.attention ?? '',
    origin: record.origin ?? '',
    publicToken: record.public_token ?? undefined,
    publicStatusEnabled: record.public_status_enabled ?? undefined,
    publicStatusClosedAt: record.public_status_closed_at ? toIsoString(record.public_status_closed_at) : undefined,
    createdAt: toIsoString(record.created_at),
    updatedAt: toIsoString(record.updated_at),
  };
}

function mapPipelineStageRecord(record: PipelineStageRecord): CrmPipelineStage {
  return {
    id: record.id,
    key: record.key,
    name: record.name,
    position: record.position,
    color: record.color ?? 'bg-gray-100 text-gray-500',
    isDefault: record.is_default,
  };
}

function mapDealRecord(record: DealRecord): CrmDeal {
  return {
    id: record.id,
    clientId: record.client_id,
    stageId: record.stage_id,
    title: record.title,
    value: record.value ?? 0,
    probability: record.probability,
    status: record.status,
    expectedCloseAt: record.expected_close_at ? toIsoString(record.expected_close_at) : undefined,
    createdAt: toIsoString(record.created_at),
    updatedAt: toIsoString(record.updated_at),
  };
}

function mapPersonType(personType: Client['personType']) {
  return personType.trim().toLowerCase().startsWith('j') ? 'company' : 'individual';
}

function mapClientInput(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>, organizationId: string) {
  return {
    organization_id: organizationId,
    person_type: mapPersonType(client.personType),
    name: client.name,
    tax_id: client.taxId,
    email: client.email,
    phone: client.phone,
    company: client.company ?? null,
    contact_name: client.contactName ?? null,
    contact_role: client.contactRole ?? null,
    contact_email: client.contactEmail ?? null,
    contact_phone: client.contactPhone ?? null,
    status: client.status,
    address_street: client.address.street,
    address_number: client.address.number,
    address_complement: client.address.complement ?? null,
    address_zip_code: client.address.zipCode,
    address_neighborhood: client.address.neighborhood,
    address_city: client.address.city,
    address_state: client.address.state,
    due_day: client.dueDay,
    pix_key: client.pixKey ?? null,
    banking_info: client.bankingInfo ?? null,
    tags: client.tags,
    attention: client.attention,
    origin: client.origin,
  };
}

function mapTimelineEventRecord(record: ClientEventRecord): TimelineEvent {
  return {
    id: record.id,
    clientId: record.client_id,
    type: record.type,
    title: record.title,
    content: record.content,
    metadata: record.metadata ?? undefined,
    createdAt: toIsoString(record.created_at),
    createdBy: record.created_by ?? 'system',
  };
}

export class SupabaseClientRepository extends SupabaseRepository {
  constructor(supabase: SupabaseClient, organizationId: string) {
    super(supabase, organizationId);
  }

  async listClients() {
    const rows = await this.unwrap(
      this.supabase
        .from('clients')
        .select('*')
        .eq('organization_id', this.organizationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      'Nao foi possivel carregar os clientes.',
    );

    return clientRecordSchema.array().parse(rows).map(mapClientRecord);
  }

  async createClient(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) {
    await this.unwrap(
      this.supabase.from('clients').insert(mapClientInput(client, this.organizationId)).select('id'),
      'Nao foi possivel criar o cliente.',
    );
  }

  async updateClient(id: string, data: Partial<Client>) {
    const payload: Record<string, unknown> = {};

    if (data.personType !== undefined) payload.person_type = mapPersonType(data.personType);
    if (data.name !== undefined) payload.name = data.name;
    if (data.taxId !== undefined) payload.tax_id = data.taxId;
    if (data.email !== undefined) payload.email = data.email;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.company !== undefined) payload.company = data.company ?? null;
    if (data.contactName !== undefined) payload.contact_name = data.contactName ?? null;
    if (data.contactRole !== undefined) payload.contact_role = data.contactRole ?? null;
    if (data.contactEmail !== undefined) payload.contact_email = data.contactEmail ?? null;
    if (data.contactPhone !== undefined) payload.contact_phone = data.contactPhone ?? null;
    if (data.status !== undefined) payload.status = data.status;
    if (data.address !== undefined) {
      payload.address_street = data.address.street;
      payload.address_number = data.address.number;
      payload.address_complement = data.address.complement ?? null;
      payload.address_zip_code = data.address.zipCode;
      payload.address_neighborhood = data.address.neighborhood;
      payload.address_city = data.address.city;
      payload.address_state = data.address.state;
    }
    if (data.dueDay !== undefined) payload.due_day = data.dueDay;
    if (data.pixKey !== undefined) payload.pix_key = data.pixKey ?? null;
    if (data.bankingInfo !== undefined) payload.banking_info = data.bankingInfo ?? null;
    if (data.tags !== undefined) payload.tags = data.tags;
    if (data.attention !== undefined) payload.attention = data.attention;
    if (data.origin !== undefined) payload.origin = data.origin;
    if (data.publicStatusEnabled !== undefined) payload.public_status_enabled = data.publicStatusEnabled;
    if (data.publicStatusClosedAt !== undefined) {
      payload.public_status_closed_at = data.publicStatusClosedAt ?? null;
    }

    await this.unwrap(
      this.supabase
        .from('clients')
        .update(payload)
        .eq('organization_id', this.organizationId)
        .eq('id', id)
        .select('id'),
      'Nao foi possivel atualizar o cliente.',
    );
  }

  async softDeleteClient(id: string) {
    const { error } = await this.supabase
      .from('clients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('organization_id', this.organizationId)
      .eq('id', id);

    if (error) {
      throw new DataLayerError(error.message || 'Nao foi possivel remover o cliente.', error.code, error);
    }
  }

  async listEvents(clientId: string) {
    const rows = await this.unwrap(
      this.supabase
        .from('client_events')
        .select('*')
        .eq('organization_id', this.organizationId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
      'Nao foi possivel carregar os eventos do cliente.',
    );

    return clientEventRecordSchema.array().parse(rows).map(mapTimelineEventRecord);
  }

  async createEvent(
    clientId: string,
    event: Omit<TimelineEvent, 'id' | 'createdAt' | 'createdBy'>,
    createdBy: string,
  ) {
    await this.unwrap(
      this.supabase.from('client_events').insert({
        organization_id: this.organizationId,
        client_id: clientId,
        type: event.type,
        title: event.title,
        content: event.content,
        metadata: event.metadata ?? null,
        created_by: createdBy,
      }).select('id'),
      'Nao foi possivel registrar o evento do cliente.',
    );
  }

  async deleteEvent(clientId: string, eventId: string) {
    await this.unwrap(
      this.supabase
        .from('client_events')
        .delete()
        .eq('organization_id', this.organizationId)
        .eq('client_id', clientId)
        .eq('id', eventId)
        .select('id'),
      'Nao foi possivel excluir o evento do cliente.',
    );
  }

  async listPipelineStages() {
    const rows = await this.unwrap(
      this.supabase
        .from('crm_pipeline_stages')
        .select('*')
        .eq('organization_id', this.organizationId)
        .order('position', { ascending: true }),
      'Nao foi possivel carregar os estagios do pipeline.',
    );

    return pipelineStageRecordSchema.array().parse(rows).map(mapPipelineStageRecord);
  }

  async listDeals() {
    const rows = await this.unwrap(
      this.supabase
        .from('crm_deals')
        .select('*')
        .eq('organization_id', this.organizationId)
        .eq('status', 'open')
        .order('updated_at', { ascending: false }),
      'Nao foi possivel carregar o pipeline.',
    );

    return dealRecordSchema.array().parse(rows).map(mapDealRecord);
  }

  async moveDeal(deal: CrmDeal, nextStage: CrmPipelineStage, previousStageName: string, createdBy: string) {
    await this.unwrap(
      this.supabase
        .from('crm_deals')
        .update({ stage_id: nextStage.id })
        .eq('organization_id', this.organizationId)
        .eq('id', deal.id)
        .select('id'),
      'Nao foi possivel mover a oportunidade.',
    );

    await this.createEvent(
      deal.clientId,
      {
        clientId: deal.clientId,
        type: 'system',
        title: 'Pipeline atualizado',
        content: `${deal.title}: ${previousStageName} -> ${nextStage.name}`,
        metadata: {
          dealId: deal.id,
          from: previousStageName,
          to: nextStage.name,
        },
      },
      createdBy,
    );
  }
}

export function createClientRepository(supabase: SupabaseClient, organizationId: string) {
  return new SupabaseClientRepository(supabase, organizationId);
}
