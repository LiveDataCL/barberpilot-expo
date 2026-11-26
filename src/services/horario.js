// Pure helpers of the Horario tab. They mirror the panel's Horarios tab (barberpilot-control, index.html):
//   cuerpoMarcar  = registrarHora(): {bid, tipo}; hora only when given; motivo only together with hora.
//   RE_HHMM       = the panel's time check before "Guardar hora".
//   jornadaTexto  = the panel's "Jornada" text.
//   notaDe        = the panel's note under a recorded time.
// No I/O here: the screen does the request (fetchAutenticado) and shows the result.

export const RE_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const cuerpoMarcar = (bid, tipo, hora, motivo) => {
  const body = { bid, tipo };
  if (hora) body.hora = hora;
  const m = (motivo || '').trim();
  if (hora && m) body.motivo = m;
  return body;
};

const minutos = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };

export const jornadaTexto = (entrada, salida) => {
  if (!entrada || !salida) return '—';
  const mins = minutos(salida) - minutos(entrada);
  if (mins <= 0) return 'Revisar horas';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h + 'h' + (m > 0 ? ' ' + m + 'm' : '');
};

export const notaDe = (meta) => {
  if (!meta) return null;
  if (meta.origen === 'ajuste') return 'ajustada · anotada a las ' + meta.hora_servidor + ' por ' + meta.por;
  if (meta.origen === 'legado') return 'registrada desde el panel anterior';
  return 'marcada a las ' + meta.hora_servidor + ' por ' + meta.por;
};
