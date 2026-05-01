import React from 'react';
import { Button, Switch, Text, TextInput, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { clientQuickCreateSchema } from '@mykante/shared/validation/client';
import { styles } from '../shared/styles';
import type { QuickClientForm, QuickClientInput } from './useMobileClients';

type Props = {
  saving: boolean;
  error?: string | null;
  onSubmit: (input: QuickClientForm) => void;
};

export function ClientQuickCreateForm({ saving, error, onSubmit }: Props) {
  const form = useForm<QuickClientInput, unknown, QuickClientForm>({
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

  return (
    <View style={styles.card}>
      <TextInput
        value={form.watch('name')}
        onChangeText={(value) => form.setValue('name', value)}
        placeholder="Nome"
        style={styles.input}
      />
      <TextInput
        value={form.watch('phone')}
        onChangeText={(value) => form.setValue('phone', value)}
        placeholder="Telefone"
        keyboardType="phone-pad"
        style={styles.input}
      />
      <TextInput
        value={form.watch('email') ?? ''}
        onChangeText={(value) => form.setValue('email', value)}
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <View style={styles.switchRow}>
        <Text>WhatsApp ativo</Text>
        <Switch value={form.watch('whatsappOptIn')} onValueChange={(value) => form.setValue('whatsappOptIn', value)} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={saving ? 'Salvando...' : 'Salvar'} disabled={saving} onPress={form.handleSubmit(onSubmit)} />
    </View>
  );
}
