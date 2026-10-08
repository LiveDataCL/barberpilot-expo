import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants';

// expo-secure-store is already a compiled-in native dependency (used for
// bp_auth_token) — reusing it here means this whole feature ships as a pure
// JS/OTA update, no new native module, no new build. Payload is compact
// (bid/nombre/iniciales/color/activo for a handful of barbers, well under
// 1KB), nowhere close to any per-item size limit.
const CACHE_KEY = 'bp_barberos_cache_v1';

// Cap how long "Cargando barberos…" can show with no cache to fall back on —
// a stalled request (bad signal, server hang) shouldn't leave the login
// screen stuck indefinitely with no way forward.
const FETCH_TIMEOUT_MS = 8000;

const _DEFAULT_COLOR = '#c9a84c';
const _DEFAULT_BG    = 'rgba(201,168,76,.18)';

function _merge(apiList) {
  return apiList.map(b => ({
    bid:       b.bid,
    nombre:    b.nombre,
    iniciales: b.iniciales,
    color:     b.color || _DEFAULT_COLOR,
    letra:     (b.iniciales || b.nombre || '?')[0],
    bg:        _DEFAULT_BG,
    rol:       'barbero',
  }));
}

function _toCompact(apiList) {
  return apiList.map(b => ({
    bid: b.bid, nombre: b.nombre, iniciales: b.iniciales,
    color: b.color || null, activo: b.activo !== false,
  }));
}

// Exported so App.js's session-restore path (outside this hook's component
// tree) can resolve a bid → display profile from the same cache, instead of
// its own separate fallback.
export async function loadCachedBarberos() {
  try {
    const raw = await SecureStore.getItemAsync(CACHE_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length ? _merge(list) : null;
  } catch {
    return null;
  }
}

async function _saveCache(apiList) {
  try {
    await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(_toCompact(apiList)));
  } catch {
    // Non-fatal — worst case, next load just starts from an empty cache
    // again instead of a stale-while-revalidate one.
  }
}

function _fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Never falls back to a hardcoded list. Order: live GET /barberos first
// (capped at FETCH_TIMEOUT_MS — a stalled request doesn't hang forever); if
// that fails or times out, the last-known-good cache from SecureStore; if
// both fail (or it's a first-ever launch with no cache yet), `error` is set
// so callers can show a clear message — with a `retry()` escape hatch —
// instead of silently rendering an empty/stale roster.
export function useBarberos() {
  const [barberos, setBarberos] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const retry = useCallback(() => {
    setError(false);
    setLoading(true);
    setRetryTick(t => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = await loadCachedBarberos();
      if (!cancelled && cached) setBarberos(cached);

      try {
        const r = await _fetchWithTimeout(`${API_URL}/barberos`, FETCH_TIMEOUT_MS);
        const list = await r.json();
        if (cancelled) return;
        if (Array.isArray(list) && list.length) {
          setBarberos(_merge(list));
          _saveCache(list);
        } else if (!cached) {
          setError(true);
        }
      } catch {
        // Covers both a real network failure and the abort() timeout firing.
        if (!cancelled && !cached) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [retryTick]);

  return { barberos, loading, error, retry };
}
