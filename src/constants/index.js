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

// ─── BARBEROS ─────────────────────────────────────────────────
export const BARBEROS = [
  { bid: 'b1', nombre: 'Didian',  pin: '1234', color: '#c9a84c', letra: 'D',  bg: 'rgba(201,168,76,.18)', rol: 'barbero' },
  { bid: 'b2', nombre: 'Emerson', pin: '5678', color: '#4db87a', letra: 'E',  bg: 'rgba(77,184,122,.15)', rol: 'barbero' },
  { bid: 'b3', nombre: 'Samuel',  pin: '9012', color: '#5580d4', letra: 'S',  bg: 'rgba(85,128,212,.15)', rol: 'barbero' },
  { bid: 'b4', nombre: 'David',   pin: '3456', color: '#a855d4', letra: 'DV', bg: 'rgba(168,85,212,.15)', rol: 'barbero' },
];

export const ADMIN = {
  bid: 'admin', nombre: 'Admin', pin: '000000', color: '#c9a84c',
  letra: '⚡', bg: 'rgba(201,168,76,.2)', rol: 'admin',
  useBiometrics: true,
};

export const SOCIOS = [
  { bid: 'socio1', nombre: 'Socio', pin: '1111', color: '#5580d4',
    letra: '👁', bg: 'rgba(85,128,212,.15)', rol: 'socio' },
];

export const TODOS_PERFILES = [ADMIN, ...BARBEROS, ...SOCIOS];

// ─── SERVICIOS ────────────────────────────────────────────────
export const SERVICIOS = [
  { id: 's01', nom: 'Corte',                       precio: 12000 },
  { id: 's02', nom: 'Barba',                        precio: 10000 },
  { id: 's03', nom: 'Corte + Barba',                precio: 20000 },
  { id: 's04', nom: 'Corte + Perfilado de barba',   precio: 16000 },
  { id: 's05', nom: 'Perfilado de corte',           precio:  6000 },
  { id: 's06', nom: 'Perfilado de cejas',           precio:  4000 },
  { id: 's07', nom: 'Barba + Cejas',                precio: 13000 },
  { id: 's08', nom: 'Perfilado de barba',           precio:  6000 },
  { id: 's09', nom: 'Matizado canas cabello',       precio:  8000 },
  { id: 's10', nom: 'Matizado canas barba',         precio:  5000 },
  { id: 's11', nom: 'Corte Express + Perf. barba',  precio: 15000 },
  { id: 'custom', nom: 'Servicio especial…',        precio:  0    },
];

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
