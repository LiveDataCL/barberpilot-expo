import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_URL, COLORS } from '../constants';

export default function SetupPinScreen({ perfil, loginPin, onDone }) {
  const [newPin,     setNewPin]     = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [msg,        setMsg]        = useState(null);

  const guardar = async () => {
    setMsg(null);
    if (!/^\d{4}$/.test(newPin)) {
      setMsg({ ok: false, txt: 'El PIN debe ser exactamente 4 dígitos' });
      return;
    }
    if (newPin !== confirmPin) {
      setMsg({ ok: false, txt: 'Los PINs no coinciden' });
      return;
    }
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('bp_auth_token');
      const res = await fetch(`${API_URL}/api/v2/auth/set-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_pin:  loginPin,
          new_pin:      newPin,
          confirm_pin:  confirmPin,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        onDone();
      } else {
        setMsg({ ok: false, txt: json.error || 'Error al guardar PIN' });
      }
    } catch {
      Alert.alert('Sin conexión', 'No se pudo guardar el PIN. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
        <View style={s.logoMark}>
          <Text style={s.logoGlyph}>✂</Text>
        </View>

        <Text style={s.title}>Crea tu PIN personal</Text>
        <Text style={s.subtitle}>
          Elige un PIN de 4 dígitos que solo tú conozcas.
          {perfil?.nombre ? `\nBienvenido, ${perfil.nombre}.` : ''}
        </Text>

        <View style={s.field}>
          <Text style={s.label}>Nuevo PIN</Text>
          <TextInput
            style={s.input}
            value={newPin}
            onChangeText={t => { setNewPin(t.replace(/\D/g, '').slice(0, 4)); setMsg(null); }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            placeholder="••••"
            placeholderTextColor={COLORS.text3}
            returnKeyType="next"
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Confirmar PIN</Text>
          <TextInput
            style={s.input}
            value={confirmPin}
            onChangeText={t => { setConfirmPin(t.replace(/\D/g, '').slice(0, 4)); setMsg(null); }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            placeholder="••••"
            placeholderTextColor={COLORS.text3}
            returnKeyType="done"
            onSubmitEditing={guardar}
          />
        </View>

        {msg && (
          <Text style={[s.msgTxt, msg.ok ? s.msgOk : s.msgErr]}>{msg.txt}</Text>
        )}

        <TouchableOpacity
          style={[s.btn, loading && s.btnDis]}
          onPress={guardar}
          disabled={loading}
          activeOpacity={0.8}>
          {loading
            ? <ActivityIndicator color="#0a0806" size="small" />
            : <Text style={s.btnTxt}>Guardar PIN</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#1a1916' },
  inner:    { flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingVertical: 48 },
  logoMark: { width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(201,168,76,.15)', borderWidth: 1,
    borderColor: 'rgba(201,168,76,.35)', alignItems: 'center',
    justifyContent: 'center', marginBottom: 28 },
  logoGlyph:{ fontSize: 26, color: '#c9a84c' },
  title:    { fontSize: 28, color: '#f0ebe0', textAlign: 'center', marginBottom: 10,
    fontFamily: 'Montserrat_700Bold', letterSpacing: 0.3 },
  subtitle: { fontSize: 14, color: '#9c8f78', textAlign: 'center', lineHeight: 21,
    marginBottom: 36, fontFamily: 'Montserrat_400Regular' },
  field:    { width: '100%', marginBottom: 18 },
  label:    { fontSize: 11, color: '#c9a84c', letterSpacing: 2,
    textTransform: 'uppercase', marginBottom: 8, fontFamily: 'Montserrat_500Medium' },
  input:    { width: '100%', height: 52, borderWidth: 1, borderColor: '#2a2318',
    borderRadius: 10, backgroundColor: '#111009', color: '#f0ebe0',
    fontSize: 22, textAlign: 'center', letterSpacing: 10,
    fontFamily: 'Montserrat_700Bold' },
  msgTxt:   { fontSize: 13, textAlign: 'center', marginBottom: 12,
    fontFamily: 'Montserrat_400Regular' },
  msgOk:    { color: '#4db87a' },
  msgErr:   { color: '#e05555' },
  btn:      { width: '100%', height: 52, backgroundColor: '#c9a84c',
    borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnDis:   { opacity: 0.5 },
  btnTxt:   { fontSize: 15, color: '#0a0806', fontFamily: 'Montserrat_700Bold',
    letterSpacing: 0.5 },
});
