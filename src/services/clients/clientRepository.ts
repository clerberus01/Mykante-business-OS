import type { SupabaseClient } from '@supabase/supabase-js';
import type { Client, TimelineEvent } from '../../types';
import { SupabaseRepository } from '../shared/supabaseRepository';
import { DataLayerError } from '../shared/dataErrors';
import { normalizeStringArray, toUnixTimestamp } from '../shared/mappers';

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
    createdAt: toUnixTimestamp(record.created_at),
    updatedAt: toUnixTimestamp(record.updated_at),
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
    createdAt: toUnixTimestamp(record.created_at),
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

    return (rows as ClientRecord[]).map(mapClientRecord);
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

    return (rows as ClientEventRecord[]).map(mapTimelineEventRecord);
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
}

export function createClientRepository(supabase: SupabaseClient, organizationId: string) {
  return new SupabaseClientRepository(supabase, organizationId);
}
