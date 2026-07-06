import { useState, useEffect } from 'react';
import { API_URL, BARBEROS_FALLBACK } from '../constants';

const _DEFAULT_COLOR = '#c9a84c';
const _DEFAULT_BG    = 'rgba(201,168,76,.18)';

function _merge(apiList) {
  const fallbackMap = {};
  BARBEROS_FALLBACK.forEach(b => { fallbackMap[b.bid] = b; });
  return apiList.map(b => {
    const fb = fallbackMap[b.bid] || {};
    return {
      bid:       b.bid,
      nombre:    b.nombre,
      iniciales: b.iniciales,
      color:     fb.color || _DEFAULT_COLOR,
      letra:     fb.letra || b.iniciales[0],
      bg:        fb.bg    || _DEFAULT_BG,
      rol:       fb.rol   || 'barbero',
    };
  });
}

export function useBarberos() {
  const [barberos, setBarberos] = useState(BARBEROS_FALLBACK);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/barberos`)
      .then(r => r.json())
      .then(list => {
        if (!cancelled && Array.isArray(list) && list.length) {
          setBarberos(_merge(list));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { barberos, loading };
}
