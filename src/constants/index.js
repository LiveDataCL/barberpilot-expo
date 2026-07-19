// ─── COLORES ─────────────────────────────────────────────────
export const COLORS = {
  bg:      '#080706',
  s1:      '#111009',
  s2:      '#181510',
  s3:      '#221c12',
  border:  '#2a2318',
  border2: '#3d3325',
  text:    '#f0ebe0',
  text2:   '#9c8f78',
  text3:   '#5c5040',
  gold:    '#c9a84c',
  gold2:   '#e8c97a',
  gold3:   '#7a5f20',
  ok:      '#4db87a',
  ok2:     '#1a5c34',
  red:     '#e05555',
  blue:    '#5580d4',
  purple:  '#a855d4',
};

// ─── API ──────────────────────────────────────────────────────
export const API_URL = 'https://barberpilot-api-production.up.railway.app';

export const IS_STAGING = false;

// ─── BARBEROS ─────────────────────────────────────────────────
export const BARBEROS_FALLBACK = [
  { bid: 'b1', nombre: 'Didian',  iniciales: 'DI', color: '#c9a84c', letra: 'D',  bg: 'rgba(201,168,76,.18)', rol: 'barbero' },
  { bid: 'b2', nombre: 'Emerson', iniciales: 'EM', color: '#4db87a', letra: 'E',  bg: 'rgba(77,184,122,.15)', rol: 'barbero' },
  { bid: 'b5', nombre: 'Steven',  iniciales: 'ST', color: '#e05555', letra: 'S',  bg: 'rgba(224,85,85,.15)',  rol: 'barbero' },
  { bid: 'b6', nombre: 'Winder',  iniciales: 'WI', color: '#9b5de5', letra: 'W',  bg: 'rgba(155,93,229,.15)', rol: 'barbero' },
];

export const ADMIN = {
  bid: 'admin', nombre: 'Admin', pin: '000000', color: '#c9a84c',
  letra: '⚡', bg: 'rgba(201,168,76,.2)', rol: 'admin',
  useBiometrics: true,
};

export const SOCIOS = [
  { bid: 'socio', nombre: 'Socios', color: '#5580d4',
    letra: '👁', bg: 'rgba(85,128,212,.15)', rol: 'socio' },
];

export const TODOS_PERFILES = [ADMIN, ...BARBEROS_FALLBACK, ...SOCIOS];

// ─── SERVICIOS ────────────────────────────────────────────────
// Last-resort fallback — used only if no cached server response exists AND
// GET /config/negocio also fails (e.g. first-ever launch, offline). Live data
// comes from App.js's catalogo state, fetched from GET /config/negocio; see
// mapServiciosDesdeServidor() in App.js. Note this fallback is missing s12
// (Corte + Cejas), which only exists server-side — a real gap this cutover
// fixes, not just a naming-drift cleanup.
export const SERVICIOS_FALLBACK = [
  { id: 's01', nom: 'Corte clásico',                        precio: 13000 },
  { id: 's02', nom: 'Barba',                                precio: 10000 },
  { id: 's03', nom: 'Corte + Barba',                        precio: 22000 },
  { id: 's04', nom: 'Corte + Perfilado de barba',           precio: 16000 },
  { id: 's05', nom: 'Perfilado de corte',                   precio:  6000 },
  { id: 's06', nom: 'Perfilado de cejas',                   precio:  4000 },
  { id: 's07', nom: 'Barba + Cejas',                        precio: 13000 },
  { id: 's08', nom: 'Perfilado de barba',                   precio:  6000 },
  { id: 's09', nom: 'Matizado ganas de cabello',            precio:  8000 },
  { id: 's10', nom: 'Matizado ganas de barba',              precio:  5000 },
  { id: 'custom', nom: 'Especial…',                         precio:  0    },
];

// ─── TYPE TOKENS ──────────────────────────────────────────────
export const TYPE = {
  hero:     { fontFamily: 'Montserrat_700Bold',            fontSize: 72, lineHeight: 80 },
  display:  { fontFamily: 'Montserrat_700Bold',            fontSize: 42, lineHeight: 50 },
  sig:      { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 18 },
  num:      { fontFamily: 'Montserrat_700Bold',            fontSize: 24 },
  title:    { fontFamily: 'Montserrat_700Bold',            fontSize: 18 },
  sub:      { fontFamily: 'Montserrat_500Medium',          fontSize: 14 },
  body:     { fontFamily: 'Montserrat_400Regular',         fontSize: 14 },
  label:    { fontFamily: 'Montserrat_500Medium',          fontSize: 11 },
  navLabel: { fontFamily: 'Montserrat_500Medium',          fontSize: 10 },
  caption:  { fontFamily: 'Montserrat_400Regular',         fontSize: 10 },
};

// ─── HELPERS ──────────────────────────────────────────────────
export const fmt = (n) =>
  Math.round(n).toLocaleString('es-CL');

export const fmtM = (n) =>
  n >= 1000000
    ? '$' + (n / 1000000).toFixed(1) + 'M'
    : n >= 1000
    ? '$' + Math.round(n / 1000) + 'K'
    : '$' + Math.round(n);

export const hoy = () => {
  const d = new Date();
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
  );
};

export const mesPeriodo = () => {
  const d = new Date();
  return (
    d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0')
  );
};
