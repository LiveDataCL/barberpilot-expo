import { API_URL } from '../constants';

const call = async (path, opts = {}) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  return res.json();
};

export const api = {
  // Datos del barbero hoy
  hoy: (bid) => call(`/barbero/${bid}/hoy`),

  // Datos del mes
  mes: (bid, periodo) => call(`/barbero/${bid}/mes/${periodo}`),

  // Ranking del mes
  ranking: (periodo) => call(`/stats/mes/${periodo}`),

  // Registrar servicio (pendiente de aprobación)
  registrar: (reg) =>
    call('/registros/barbero', {
      method: 'POST',
      body: JSON.stringify(reg),
    }),

  // Subir comprobante de transferencia (base64)
  subirFoto: (regId, base64, mimeType = 'image/jpeg') =>
    call('/comprobantes', {
      method: 'POST',
      body: JSON.stringify({ regId, imagen: base64, mimeType }),
    }),

  // Pendientes propios
  pendientes: (bid) =>
    call('/pendientes').then((r) =>
      ({ ...r, pendientes: (r.pendientes || []).filter((p) => p.bid === bid) })
    ),
};
