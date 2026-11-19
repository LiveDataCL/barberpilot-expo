import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants';

const TIMEOUT_MS = 10000;

// Fingerprint entry check: true only when the stored token is valid AND belongs to an admin (GET /api/v2/auth/me).
// Any doubt (no token, network error, non-admin role) is false, and the caller then asks for the 6-digit PIN.
export async function sesionAdminValida() {
  const token = await SecureStore.getItemAsync(SESSION_KEY).catch(() => null);
  if (!token) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${API_URL}/api/v2/auth/me`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
    if (!r.ok) return false;
    const j = await r.json();
    return !!j.ok && j.role === 'admin';
  } catch { return false; } finally { clearTimeout(timer); }
}

// Session token saved at login. Sent with every call; routes that do not check it ignore it.
const SESSION_KEY = 'bp_auth_token';
export const MSG_SESION = 'Tu sesión expiró o no está iniciada. Vuelve a ingresar.';

// Listeners told when an authenticated call gets 401 (the session is gone or expired). App.js uses this to send the user
// back to the login screen; an admin goes straight to the 6-digit PIN step. Never leaves the admin UI without a token.
const _listenersSesion = new Set();
export function onSesionExpirada(cb) { _listenersSesion.add(cb); return () => _listenersSesion.delete(cb); }
function _avisarSesionExpirada() { _listenersSesion.forEach(cb => { try { cb(); } catch {} }); }

async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const token = await SecureStore.getItemAsync(SESSION_KEY).catch(() => null);
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(response.status === 401 ? MSG_SESION : (error.error || `HTTP ${response.status}`));
      err.status = response.status;
      if (response.status === 401 && !path.startsWith('/api/v2/auth/')) _avisarSesionExpirada();
      throw err;
    }

    return await response.json();
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      throw new Error('La conexión tardó demasiado. Intenta de nuevo.');
    }
    throw e;
  }
}

// fetch with the session token (TD-022..TD-024: money reads and booking writes need an authenticated session).
// Takes a path like "/registros/dia?fecha=2026-11-19". Same token store as apiFetch.
export async function fetchAutenticado(path, options = {}) {
  const token = await SecureStore.getItemAsync(SESSION_KEY).catch(() => null);
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export const api = {
  get:    (path)        => apiFetch(path),
  post:   (path, data)  => apiFetch(path, { method: 'POST',   body: JSON.stringify(data) }),
  patch:  (path, data)  => apiFetch(path, { method: 'PATCH',  body: JSON.stringify(data) }),
  delete: (path)        => apiFetch(path, { method: 'DELETE' }),

  // Domain methods
  hoy:     (bid)           => apiFetch(`/barbero/${bid}/hoy`),
  mes:     (bid, periodo)  => apiFetch(`/barbero/${bid}/mes/${periodo}`),
  ranking: (periodo)       => apiFetch(`/stats/mes/${periodo}`),

  registrar: async (reg) => {
    try {
      return await apiFetch('/registros', { method: 'POST', body: JSON.stringify(reg) });
    } catch (e) {
      // 409 = duplicate — not a failure, caller handles it
      if (e.status === 409) return { ok: false, error: 'duplicate' };
      throw e;
    }
  },

  subirFoto: (regId, base64, mimeType = 'image/jpeg') =>
    apiFetch('/comprobantes', { method: 'POST', body: JSON.stringify({ regId, imagen: base64, mimeType }) }),

  queue:        (barberId)       => apiFetch(`/queue?barber=${barberId}`),
  queueStats:   ()               => apiFetch('/queue/stats'),
  updateStatus: (id, status) =>
    apiFetch(`/queue/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  notify:       (id, type)       => apiFetch(`/queue/${id}/notify`, { method: 'POST', body: JSON.stringify({ type }) }),

  agenda: (bid, fecha) => apiFetch(`/appointments?bid=${bid}&fecha=${fecha}`),
};
