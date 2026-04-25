import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Client, TimelineEvent } from '../../types';
import { createClientRepository, toDataLayerError } from '../../services';
import { useRepositoryContext } from './useRepositoryContext';

export function useSupabaseClients() {
  const { supabase, organizationId } = useRepositoryContext();
  const repository = useMemo(
    () => (organizationId ? createClientRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(Boolean(organizationId));

  const loadClients = useCallback(async () => {
    if (!repository) {
      setClients([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setClients(await repository.listClients());
    } catch (error) {
      console.warn('Supabase clients load failed:', toDataLayerError(error, 'Falha ao carregar clientes.'));
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const addClient = useCallback(
    async (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!repository) return;
      await repository.createClient(client);
      await loadClients();
    },
    [loadClients, repository],
  );

  const deleteClient = useCallback(
    async (id: string) => {
      if (!repository) return;
      if (!window.confirm('Deseja realmente excluir este cliente?')) return;
      await repository.softDeleteClient(id);
      await loadClients();
    },
    [loadClients, repository],
  );

  const updateClient = useCallback(
    async (id: string, data: Partial<Client>) => {
      if (!repository) return;
      await repository.updateClient(id, data);
      await loadClients();
    },
    [loadClients, repository],
  );

  return { clients, loading, addClient, deleteClient, updateClient, refreshClients: loadClients };
}

export function useSupabaseEvents(clientId: string | null) {
  const { supabase, organizationId, currentUserName } = useRepositoryContext();
  const repository = useMemo(
    () => (organizationId ? createClientRepository(supabase, organizationId) : null),
    [organizationId, supabase],
  );
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(Boolean(clientId && organizationId));

  const loadEvents = useCallback(async () => {
    if (!repository || !clientId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setEvents(await repository.listEvents(clientId));
    } catch (error) {
      console.warn('Supabase client events load failed:', toDataLayerError(error, 'Falha ao carregar eventos.'));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, repository]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const addEvent = useCallback(
    async (event: Omit<TimelineEvent, 'id' | 'createdAt' | 'createdBy'>) => {
      if (!repository || !clientId) return;
      await repository.createEvent(clientId, event, currentUserName);
      await loadEvents();
    },
    [clientId, currentUserName, loadEvents, repository],
  );

  const deleteEvent = useCallback(
    async (eventId: string) => {
      if (!repository || !clientId) return;
      await repository.deleteEvent(clientId, eventId);
      await loadEvents();
    },
    [clientId, loadEvents, repository],
  );

  return { events, loading, addEvent, deleteEvent, refreshEvents: loadEvents };
}
