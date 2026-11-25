// The preview guard, imported as the FIRST import of App.js (before any module that could capture `fetch`).
// The variant comes from the build-time config (app.config.js → extra.appVariant, embedded in the binary). The preview build has
// updates disabled (app.config.js), so no server or OTA response can change it. No runtime input, storage or response is read here.
import Constants from 'expo-constants';
import { instalarGuardia, autoprueba, MENSAJE_BLOQUEO } from './previewGuardCore';

export const VARIANTE = Constants.expoConfig?.extra?.appVariant === 'preview' ? 'preview' : 'produccion';
export const ES_PREVIEW = VARIANTE === 'preview';

let estado = ES_PREVIEW ? 'pendiente' : 'inactivo';   // 'pendiente' | 'activo' | 'fallido' | 'inactivo'
const escuchasEstado = new Set();
const escuchasBloqueo = new Set();

export function estadoGuardia() { return estado; }
export function suscribirEstado(cb) { escuchasEstado.add(cb); return () => escuchasEstado.delete(cb); }
export function suscribirBloqueo(cb) { escuchasBloqueo.add(cb); return () => escuchasBloqueo.delete(cb); }
export const TEXTO_BLOQUEO = MENSAJE_BLOQUEO;

const instalacion = instalarGuardia({
  variante: VARIANTE,
  target: globalThis,
  realFetch: globalThis.fetch,
  onBloqueo: () => escuchasBloqueo.forEach(cb => cb()),
});

if (ES_PREVIEW) {
  // the self-test goes through the global fetch: it proves the guard is what the App calls
  autoprueba(globalThis.fetch).then(resultado => {
    estado = resultado;
    escuchasEstado.forEach(cb => cb(resultado));
  });
}

export const GUARDIA_ACTIVA = instalacion.activo;
