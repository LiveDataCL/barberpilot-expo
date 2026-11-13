import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants';

const TIMEOUT_MS = 10000;

// Session token saved at login. Sent with every call; routes that do not check it ignore it.
const SESSION_KEY = 'bp_auth_token';
export const MSG_SESION = 'Tu sesión expiró o no está iniciada. Vuelve a ingresar.';

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

  pendientes: (bid) =>
    apiFetch('/pendientes').then((r) =>
      ({ ...r, pendientes: (r.pendientes || []).filter((p) => p.bid === bid) })
    ),

  queue:        (barberId)       => apiFetch(`/queue?barber=${barberId}`),
  queueStats:   ()               => apiFetch('/queue/stats'),
  updateStatus: (id, status) =>
    apiFetch(`/queue/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  notify:       (id, type)       => apiFetch(`/queue/${id}/notify`, { method: 'POST', body: JSON.stringify({ type }) }),

  agenda: (bid, fecha) => apiFetch(`/appointments?bid=${bid}&fecha=${fecha}`),
};
