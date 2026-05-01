import React, { useState } from 'react';
import { Button, SafeAreaView, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';
import { styles } from '../shared/styles';
import { getCodeFromQrPayload } from './mobileQr';

type Props = {
  onCancel: () => void;
  onSignedIn: () => void;
};

async function getCurrentLocation() {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== 'granted') {
    return {};
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? undefined,
  };
}

export function QrLoginScreen({ onCancel, onSignedIn }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  async function consumeQr(payload: string) {
    if (scanning) return;

    setScanning(true);
    setError('');

    try {
      const code = getCodeFromQrPayload(payload);

      if (!code) {
        throw new Error('QR code invalido.');
      }

      const location = await getCurrentLocation();
      const response = await fetch(getApiUrl('/api/auth/mobile-qr/consume'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, location }),
      });
      const result = await response.json();

      if (!response.ok || !result?.tokenHash) {
        throw new Error(result?.error || 'Nao foi possivel validar o QR code.');
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: result.tokenHash,
      });

      if (verifyError) {
        throw verifyError;
      }

      onSignedIn();
    } catch (consumeError) {
      setError(consumeError instanceof Error ? consumeError.message : 'Falha ao validar QR code.');
      setScanning(false);
    }
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <Text style={styles.title}>Login por QR</Text>
        <Text style={styles.subtitle}>Permita o uso da camera para ler o QR code gerado pelo sistema.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Permitir camera" onPress={() => void requestPermission()} />
        <Button title="Voltar" onPress={onCancel} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Login por QR</Text>
        <Button title="Voltar" onPress={onCancel} />
      </View>
      <CameraView
        style={{ flex: 1, borderRadius: 8, overflow: 'hidden' }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => void consumeQr(data)}
      />
      <Text style={styles.subtitle}>Aponte a camera para o QR code exibido no sistema.</Text>
      {scanning ? <Text style={styles.muted}>Validando acesso...</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </SafeAreaView>
  );
}
