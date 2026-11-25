// Mi evaluación (App): the barber's own evaluation of the CURRENT month, read-only. Pure functions: no React Native, no storage.
// The screen (src/components/MiEvaluacion.js) and the tests use these. The copy matches the panel's focus view (barberpilot-control,
// evaluacion-individual.js); the panel and the App are separate repos, so the strings are repeated here and must be changed together.
// The API sends only the allowlisted fields. Anything else in a response is refused (fail closed): no partial data is ever shown.

// Spanish UI strings.
export const TEXTOS = Object.freeze({
  titulo: 'Mi evaluación',
  actualizado: 'Actualizado',
  sinEvaluacion: 'Sin evaluación este mes',
  provisional: 'Provisional hasta el cierre del mes',
  sinConexion: 'sin conexión — datos de',
  errorCarga: 'No se pudo cargar tu evaluación. Desliza hacia abajo para reintentar.',
  sesion: 'Tu sesión expiró. Vuelve a ingresar.',
  descalificado: 'Descalificado este mes',
  bono: 'Se paga solo si la meta del grupo se cumple.',
  metaCumplida: 'Meta del grupo: cumplida',
  metaNoCumplida: 'Meta del grupo: aún no cumplida',
  sinBono: 'Sin bono este mes',
  proyeccion: (pts, max) => `A este ritmo cierras el mes con ${pts} / ${max} pts (estimación)`,
  proyeccionBase: (dias) => `Calculado con ${dias} días de trabajo transcurridos. No cambia el puntaje oficial.`,
  seccionPuntaje: 'Puntaje por componente',
  seccionConducta: 'Conducta por indicador (promedio del mes, de 0 a 10)',
  seccionMejorar: 'Qué mejorar',
  copiados: (n) => `Días con conducta copiada (sin cambios): ${n}`,
  sinIndicadores: 'Sin indicadores este mes.',
  componentes: Object.freeze({
    production: 'Producción', conduct: 'Conducta diaria', punctuality: 'Puntualidad',
    upselling: 'Venta adicional', tips: 'Propinas',
  }),
  tendencia: Object.freeze({ up: '▲ sube', flat: '● estable', down: '▼ baja', insufficient: 'sin tendencia aún' }),
});

// The exact shape of the API's answer (services/evaluacionIndividual.js DTO_ALLOWLIST). true = a value, an object = nested keys, [x] = a list.
export const FORMA_DTO = Object.freeze({
  barberName: true, month: true, totalScore: true, tier: true, tierNombre: true,
  disqualified: { active: true, reason: true },
  components: {
    production: { earned: true, max: true, detail: { servicios: true, metaServicios: true } },
    conduct: { earned: true, max: true },
    punctuality: { earned: true, max: true, detail: { lateBlocks: true, diasSinEntrada: true, diasSinSalida: true } },
    upselling: { earned: true, max: true, detail: { conProducto: true, servicios: true, umbralPct: true } },
    tips: { earned: true, max: true },
  },
  conductRows: [{ label: true, monthlyAvg: true, trend: true }],
  carryOverDays: true, bonusTier: true, bonusPct: true, groupGoalStatus: true,
  isProvisional: true, computedAt: true,
  improvementHints: [{ component: true, text: true }],
  productionProjection: { projectedPoints: true, max: true, basisDays: true, isEstimate: true },
});

// Every key present and no extra key, at every level. Returns the list of problems (empty = valid).
export function problemasDeForma(obj, forma, ruta = '') {
  if (forma === true) return [];
  if (obj === null) return ruta === '.productionProjection' ? [] : [ruta + ' es nulo'];   // null only for the estimate, when there is none
  if (Array.isArray(forma)) {
    if (!Array.isArray(obj)) return [ruta + ' no es lista'];
    return obj.flatMap((x, i) => problemasDeForma(x, forma[0], ruta + '[' + i + ']'));
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return [ruta + ' no es objeto'];
  const sobran = Object.keys(obj).filter(k => !(k in forma)).map(k => ruta + '.' + k + ' sobra');
  const faltan = Object.keys(forma).filter(k => !(k in obj)).map(k => ruta + '.' + k + ' falta');
  const dentro = Object.keys(obj).filter(k => k in forma).flatMap(k => problemasDeForma(obj[k], forma[k], ruta + '.' + k));
  return [...sobran, ...faltan, ...dentro];
}

export function esDtoValido(dto) {
  return problemasDeForma(dto, FORMA_DTO).length === 0;
}

// 'YYYY-MM' of a date, in the device's clock (the business runs in America/Santiago; the device is set to it).
export function mesDe(fecha = new Date()) {
  return fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0');
}

// "hh:mm" of an ISO time, in the device's clock (the business runs in America/Santiago; the device is set to it).
export function horaDe(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

const coma = (x) => String(Math.round(Number(x) * 10) / 10).replace('.', ',');
// conduct averages: always two decimals, a comma as the decimal mark ("4,00", "8,52"); the same rule as the panel
const dos = (x) => Number(x).toFixed(2).replace('.', ',');
// the days without a clock-in / clock-out mark, neutral wording (the same copy as the panel and the API hints); '' when there are none
const sinMarca = (det) => {
  const partes = [];
  if (det.diasSinEntrada > 0) partes.push((det.diasSinEntrada === 1 ? 'Día' : 'Días') + ' sin marca de entrada: ' + det.diasSinEntrada);
  if (det.diasSinSalida > 0) partes.push((det.diasSinSalida === 1 ? 'Día' : 'Días') + ' sin marca de salida: ' + det.diasSinSalida);
  return partes.join(' · ');
};

// Decides what the screen shows. Input: the answer of the API (status, parsed body, or a network failure) and the cached last good answer.
// Output: { tipo, ... }. Never shows cached data for a refusal (403) or a missing evaluation; the cache is used only when the API cannot be reached.
export function resolverEstado({ status = null, cuerpo = null, redErr = false, cache = null, mesActual = null }) {
  // a cached answer is shown only for the month it was made in: after the month changes, an offline view never shows last month as current
  const cacheVigente = cache && cache.dto && esDtoValido(cache.dto) && (mesActual === null || cache.dto.month === mesActual) ? cache : null;
  if (!redErr && status === 401) return { tipo: 'sesion', mensaje: TEXTOS.sesion, borrarCache: false };
  if (!redErr && status === 403) return { tipo: 'sin_evaluacion', mensaje: TEXTOS.sinEvaluacion, borrarCache: true };
  if (!redErr && status === 200 && cuerpo && cuerpo.ok === true) {
    if (cuerpo.disponible === false) return { tipo: 'sin_evaluacion', mensaje: TEXTOS.sinEvaluacion, borrarCache: true };
    if (cuerpo.disponible === true && esDtoValido(cuerpo.evaluacion)) {
      return { tipo: 'ok', dto: cuerpo.evaluacion, hora: horaDe(cuerpo.evaluacion.computedAt), guardar: true };
    }
    // a 200 that does not match the allowlist: refused, nothing shown, cache kept untouched
    return cacheVigente
      ? { tipo: 'sin_conexion', dto: cacheVigente.dto, hora: horaDe(cacheVigente.guardado), guardar: false }
      : { tipo: 'error', mensaje: TEXTOS.errorCarga, guardar: false };
  }
  // the API cannot be reached (network error, timeout) or answers a server error: the last good answer, labelled, if there is one
  const caido = redErr || (typeof status === 'number' && status >= 500);
  if (caido && cacheVigente) {
    return { tipo: 'sin_conexion', dto: cacheVigente.dto, hora: horaDe(cacheVigente.guardado), guardar: false };
  }
  return { tipo: 'error', mensaje: TEXTOS.errorCarga, guardar: false };
}

// The lines the screen draws, as plain data. Every value comes from the barber's own DTO. Nothing here is a peso amount,
// a group-goal amount, a month selector or another barber's data.
export function vistaDe(dto) {
  const c = dto.components;
  const maximoTotal = c.production.max + c.conduct.max + c.punctuality.max + c.upselling.max + c.tips.max;
  const tierTxt = dto.bonusPct == null ? TEXTOS.sinBono : 'Estrato ' + dto.bonusTier + ' · ' + String(dto.bonusPct).replace('.', ',') + ' %';
  const puntos = [
    { clave: 'production', nombre: TEXTOS.componentes.production, puntos: `${coma(c.production.earned)} / ${c.production.max}`,
      detalle: `${c.production.detail.servicios} servicios · meta individual de servicios ${c.production.detail.metaServicios}` },
    { clave: 'conduct', nombre: TEXTOS.componentes.conduct, puntos: `${coma(c.conduct.earned)} / ${c.conduct.max}`, detalle: null },
    { clave: 'punctuality', nombre: TEXTOS.componentes.punctuality, puntos: `${coma(c.punctuality.earned)} / ${c.punctuality.max}`,
      detalle: [`bloques de atraso o salida anticipada: ${c.punctuality.detail.lateBlocks}`, sinMarca(c.punctuality.detail)].filter(Boolean).join(' · ') },
    { clave: 'upselling', nombre: TEXTOS.componentes.upselling, puntos: `${coma(c.upselling.earned)} / ${c.upselling.max}`,
      detalle: `${c.upselling.detail.conProducto} de ${c.upselling.detail.servicios} servicios con producto (umbral ${c.upselling.detail.umbralPct} %)` },
    { clave: 'tips', nombre: TEXTOS.componentes.tips, puntos: `${coma(c.tips.earned)} / ${c.tips.max}`, detalle: null },
  ];
  const conducta = (dto.conductRows || []).map(r => ({
    etiqueta: r.label, promedio: dos(r.monthlyAvg), tendencia: TEXTOS.tendencia[r.trend] || TEXTOS.tendencia.insufficient, tendenciaClave: r.trend,
  }));
  return {
    titulo: dto.barberName,
    puntajeTxt: `${coma(dto.totalScore)}`,
    maximoTxt: `/ ${maximoTotal} pts`,
    tier: dto.tierNombre ? dto.tier + ' · ' + dto.tierNombre : dto.tier,
    descalificado: dto.disqualified && dto.disqualified.active ? TEXTOS.descalificado : null,
    tierBono: tierTxt,
    bonoNota: TEXTOS.bono,
    metaGrupo: dto.groupGoalStatus === 'met' ? TEXTOS.metaCumplida : TEXTOS.metaNoCumplida,
    proyeccion: dto.productionProjection
      ? { texto: TEXTOS.proyeccion(coma(dto.productionProjection.projectedPoints), dto.productionProjection.max), base: TEXTOS.proyeccionBase(dto.productionProjection.basisDays) }
      : null,
    puntos,
    conducta,
    copiados: TEXTOS.copiados(dto.carryOverDays),
    mejorar: (dto.improvementHints || []).map(h => h.text),
    provisional: TEXTOS.provisional,
  };
}

// Every text of the view, flattened: used by the tests to check the copy and the absence of money and other barbers.
export function textosDeLaVista(v) {
  return [v.titulo, v.puntajeTxt, v.maximoTxt, v.tier, v.descalificado, v.tierBono, v.bonoNota, v.metaGrupo, v.provisional, v.copiados,
    ...(v.proyeccion ? [v.proyeccion.texto, v.proyeccion.base] : []),
    ...v.puntos.flatMap(p => [p.nombre, p.puntos, p.detalle]),
    ...v.conducta.flatMap(r => [r.etiqueta, r.promedio, r.tendencia]),
    ...v.mejorar].filter(x => typeof x === 'string');
}
