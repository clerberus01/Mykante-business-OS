import React, { useState } from 'react';
import { Button, SafeAreaView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { styles } from '../shared/styles';
import { getAuthCredentials } from './authCredentials';

export function LoginScreen({ onQrLogin, onSignedIn }: { onQrLogin: () => void; onSignedIn: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { credentials } = getAuthCredentials(identifier);
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ ...credentials, password })
        : await supabase.auth.signUp({ ...credentials, password });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      if (mode === 'signup' && !result.data.session) {
        setMessage('Cadastro criado. Confirme seu e-mail ou telefone para concluir o acesso.');
        setMode('login');
        setPassword('');
        return;
      }

      onSignedIn();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Mykante CRM</Text>
      <Text style={styles.subtitle}>Entre com e-mail ou telefone e senha.</Text>

      <View style={styles.filters}>
        <Button title="Entrar" onPress={() => setMode('login')} />
        <Button title="Cadastro" onPress={() => setMode('signup')} />
      </View>

      <TextInput
        value={identifier}
        onChangeText={setIdentifier}
        placeholder="E-mail ou telefone"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder={mode === 'signup' ? 'Senha com minimo de 8 caracteres' : 'Senha'}
        secureTextEntry
        style={styles.input}
      />
      {message ? <Text style={styles.muted}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar cadastro'}
        disabled={loading}
        onPress={submit}
      />
      <Button title="Entrar com QR code" onPress={onQrLogin} />
    </SafeAreaView>
  );
}
