import React, { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button, FlatList, SafeAreaView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { z } from 'zod';
import { clientQuickCreateSchema } from '@mykante/shared/validation/client';
import { supabase } from './src/lib/supabase';

type ClientRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: 'lead' | 'active' | 'inactive' | 'archived';
  tags: string[] | null;
  segment: string | null;
  source: string | null;
};

type QuickClientForm = z.infer<typeof clientQuickCreateSchema>;

const queryClient = new QueryClient();

function useMobileClients(organizationId: string | undefined, filters: { search: string; status: string; tag: string }) {
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

function useCurrentOrganizationId() {
  return useQuery({
    queryKey: ['mobile-current-organization'],
    queryFn: async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error('Sessao invalida.');

      const { data, error } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data?.organization_id) throw new Error('Organizacao nao encontrada.');
      return data.organization_id as string;
    },
  });
}

function LoginGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function signIn() {
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      return;
    }
    onSignedIn();
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Mykante CRM</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="E-mail" autoCapitalize="none" style={styles.input} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Senha" secureTextEntry style={styles.input} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Entrar" onPress={signIn} />
    </SafeAreaView>
  );
}

function ClientsMvp() {
  const queryClientRef = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  const [showForm, setShowForm] = useState(false);
  const filters = useMemo(() => ({ search, status, tag }), [search, status, tag]);
  const organizationQuery = useCurrentOrganizationId();
  const clientsQuery = useMobileClients(organizationQuery.data, filters);
  const form = useForm<QuickClientForm>({
    resolver: zodResolver(clientQuickCreateSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      taxId: '',
      whatsappOptIn: true,
      source: 'mobile',
      customFields: {},
    },
  });

  const createClient = useMutation({
    mutationFn: async (input: QuickClientForm) => {
      if (!organizationQuery.data) throw new Error('Organizacao nao carregada.');

      const { error } = await supabase.from('clients').insert({
        organization_id: organizationQuery.data,
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
      form.reset();
      setShowForm(false);
      await queryClientRef.invalidateQueries({ queryKey: ['mobile-clients'] });
    },
  });

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Clientes</Text>
        <Button title="+ Novo" onPress={() => setShowForm((current) => !current)} />
      </View>

      <TextInput value={search} onChangeText={setSearch} placeholder="Buscar cliente" style={styles.input} />
      <View style={styles.filters}>
        {['', 'lead', 'active', 'inactive'].map((item) => (
          <TouchableOpacity key={item || 'all'} onPress={() => setStatus(item)} style={[styles.chip, status === item && styles.chipActive]}>
            <Text style={styles.chipText}>{item || 'todos'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput value={tag} onChangeText={setTag} placeholder="Filtrar tag" style={styles.input} />

      {showForm ? (
        <View style={styles.card}>
          <TextInput value={form.watch('name')} onChangeText={(value) => form.setValue('name', value)} placeholder="Nome" style={styles.input} />
          <TextInput value={form.watch('phone')} onChangeText={(value) => form.setValue('phone', value)} placeholder="Telefone" style={styles.input} />
          <TextInput value={form.watch('email') ?? ''} onChangeText={(value) => form.setValue('email', value)} placeholder="E-mail" style={styles.input} />
          <View style={styles.switchRow}>
            <Text>WhatsApp ativo</Text>
            <Switch value={form.watch('whatsappOptIn')} onValueChange={(value) => form.setValue('whatsappOptIn', value)} />
          </View>
          <Button title="Salvar" onPress={form.handleSubmit((input) => createClient.mutate(input))} />
        </View>
      ) : null}

      <FlatList
        data={clientsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        refreshing={clientsQuery.isFetching}
        onRefresh={() => void clientsQuery.refetch()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.clientName}>{item.name}</Text>
            <Text style={styles.muted}>{item.phone || item.email || 'Sem contato'}</Text>
            <Text style={styles.muted}>{item.status} {item.segment ? `- ${item.segment}` : ''}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function Root() {
  const [signedIn, setSignedIn] = useState(false);

  return signedIn ? <ClientsMvp /> : <LoginGate onSignedIn={() => setSignedIn(true)} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: 12,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#fff',
  },
  chipActive: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  chipText: {
    fontSize: 12,
    color: '#475569',
    textTransform: 'uppercase',
  },
  card: {
    gap: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  muted: {
    color: '#64748b',
  },
  error: {
    color: '#dc2626',
  },
});
