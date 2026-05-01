import React, { useMemo, useState } from 'react';
import { Button, FlatList, SafeAreaView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { styles } from '../shared/styles';
import { ClientQuickCreateForm } from './ClientQuickCreateForm';
import { useCreateMobileClient, useCurrentOrganizationId, useMobileClients } from './useMobileClients';

const STATUS_FILTERS = ['', 'lead', 'active', 'inactive'];

export function ClientsScreen() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  const [showForm, setShowForm] = useState(false);
  const filters = useMemo(() => ({ search, status, tag }), [search, status, tag]);
  const organizationQuery = useCurrentOrganizationId();
  const clientsQuery = useMobileClients(organizationQuery.data, filters);
  const createClient = useCreateMobileClient(organizationQuery.data);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Clientes</Text>
        <Button title="+ Novo" onPress={() => setShowForm((current) => !current)} />
      </View>

      {organizationQuery.error ? <Text style={styles.error}>{organizationQuery.error.message}</Text> : null}
      {clientsQuery.error ? <Text style={styles.error}>{clientsQuery.error.message}</Text> : null}

      <TextInput value={search} onChangeText={setSearch} placeholder="Buscar cliente" style={styles.input} />
      <View style={styles.filters}>
        {STATUS_FILTERS.map((item) => {
          const active = status === item;
          return (
            <TouchableOpacity key={item || 'all'} onPress={() => setStatus(item)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item || 'todos'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TextInput value={tag} onChangeText={setTag} placeholder="Filtrar tag" style={styles.input} />

      {showForm ? (
        <ClientQuickCreateForm
          saving={createClient.isPending}
          error={createClient.error?.message}
          onSubmit={(input) => {
            createClient.mutate(input, {
              onSuccess: () => setShowForm(false),
            });
          }}
        />
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
            <Text style={styles.muted}>
              {item.status} {item.segment ? `- ${item.segment}` : ''}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
