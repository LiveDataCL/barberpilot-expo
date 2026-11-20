import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL } from '../constants';

// Admin fingerprint ("huella en este equipo").
// The device keeps {device_id, device_token} in SecureStore with requireAuthentication: the phone's biometric or
// passcode check gates every read. The server keeps only a hash of the token, binds it to this device_id and to the
// admin profile, rotates it on each unlock, and can revoke it (Perfiles tab). The master PIN never unlocks.

const DEVICE_KEY = 'bp_device_admin_v1';
const MARKER_KEY = 'bp_device_admin_registrado';   // plain flag, no secret: "this device has a registration"
const SESSION_KEY = 'bp_auth_token';
const PROMPT = 'Verifica tu identidad para entrar como Admin';
const TIMEOUT_MS = 10000;

const opcionesProtegidas = {
  requireAuthentication: true,
  authenticationPrompt: PROMPT,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// Returns { estado: 'ok', creds } | { estado: 'sin_huella' } | { estado: 'cancelado' }.
// 'cancelado' covers a biometric cancel, a failed check, or no biometric enrolled: never a token.
export async function leerDispositivoAdmin() {
  let raw;
  try {
    raw = await SecureStore.getItemAsync(DEVICE_KEY, opcionesProtegidas);
  } catch {
    return { estado: 'cancelado' };
  }
  if (!raw) return { estado: 'sin_huella' };
  try {
    const c = JSON.parse(raw);
    if (c && c.device_id && c.device_token) return { estado: 'ok', creds: c };
  } catch { /* unreadable item: treated as none */ }
  return { estado: 'sin_huella' };
}

export async function guardarDispositivoAdmin(creds) {
  await SecureStore.setItemAsync(DEVICE_KEY, JSON.stringify(creds), opcionesProtegidas);
  await SecureStore.setItemAsync(MARKER_KEY, '1');
}

export async function borrarDispositivoAdmin() {
  await SecureStore.deleteItemAsync(DEVICE_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(MARKER_KEY).catch(() => {});
}

export async function hayRegistroLocal() {
  return (await SecureStore.getItemAsync(MARKER_KEY).catch(() => null)) === '1';
}

// Called after a successful admin PIN login, when this device has no registration yet. Failure never blocks the login.
export async function registrarDispositivoAdmin(sessionToken) {
  try {
    const r = await fetch(`${API_URL}/api/v2/auth/device/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ device_label: `Admin · ${Platform.OS === 'ios' ? 'iPhone' : 'Android'}` }),
    });
    if (!r.ok) return false;
    const j = await r.json();
    if (!j.ok || !j.device_id || !j.device_token) return false;
    await guardarDispositivoAdmin({ device_id: j.device_id, device_token: j.device_token });
    return true;
  } catch {
    return false;
  }
}

// Biometric unlock: reads the device token (the phone checks the finger), then asks the server for an admin session.
// Returns { estado: 'ok', token } | 'revocado' (the local registration is removed) | 'red' | 'sin_huella' | 'cancelado'.
export async function desbloquearAdmin() {
  const lectura = await leerDispositivoAdmin();
  if (lectura.estado !== 'ok') return { estado: lectura.estado };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let r;
  try {
    r = await fetch(`${API_URL}/api/v2/auth/device/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: lectura.creds.device_id, device_token: lectura.creds.device_token }),
      signal: controller.signal,
    });
  } catch {
    return { estado: 'red' };
  } finally {
    clearTimeout(timer);
  }
  if (r.status === 429) return { estado: 'bloqueado' };   // too many failed unlocks: wait, or use the PIN
  if (r.status === 401) {
    await borrarDispositivoAdmin();
    return { estado: 'revocado' };
  }
  if (!r.ok) return { estado: 'red' };
  let j = {};
  try { j = await r.json(); } catch { return { estado: 'red' }; }
  if (!j.ok || !j.token || !j.device_token) return { estado: 'red' };
  // Rotation: the new device token replaces the old one (the old one is already dead on the server).
  try {
    await guardarDispositivoAdmin({ device_id: lectura.creds.device_id, device_token: j.device_token });
  } catch {
    // Could not store the rotated token: the next unlock fails closed and the PIN re-registers the device.
  }
  await SecureStore.setItemAsync(SESSION_KEY, j.token);
  return { estado: 'ok', token: j.token };
}
