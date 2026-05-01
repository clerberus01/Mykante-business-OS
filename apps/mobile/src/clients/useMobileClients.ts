import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { clientQuickCreateSchema } from '@mykante/shared/validation/client';
import { supabase } from '../lib/supabase';
import type { ClientFilters, ClientRow } from './types';

export type QuickClientForm = z.infer<typeof clientQuickCreateSchema>;
export type QuickClientInput = z.input<typeof clientQuickCreateSchema>;

export function useCurrentOrganizationId() {
  return useQuery({
    queryKey: ['mobile-current-organization'],
    queryFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error('Sessao invalida.');

      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data?.organization_id) throw new Error('Organizacao nao encontrada.');
      return data.organization_id as string;
    },
  });
}

export function useMobileClients(organizationId: string | undefined, filters: ClientFilters) {
  return useQuery({
    queryKey: ['mobile-clients', organizationId, filters],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select('id,name,phone,email,status,tags,segment,source')
        .eq('organization_id', organizationId ?? '')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        query = query.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term},segment.ilike.${term}`);
      }
      if (filters.tag.trim()) query = query.contains('tags', [filters.tag.trim()]);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });
}

export function useCreateMobileClient(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: QuickClientForm) => {
      if (!organizationId) throw new Error('Organizacao nao carregada.');

      const { error } = await supabase.from('clients').insert({
        organization_id: organizationId,
        person_type: 'individual',
        name: input.name,
        phone: input.phone,
        email: input.email || '',
        tax_id: input.taxId || '',
        status: 'lead',
        source: 'mobile',
        created_from_mobile: true,
        whatsapp_opt_in: input.whatsappOptIn,
        custom_fields: input.customFields,
        tags: [],
        attention: '',
        origin: 'Mobile',
        due_day: 10,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mobile-clients'] });
    },
  });
}
