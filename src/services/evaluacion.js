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
  // tiers B, C, D and X: no bonus (owner-approved text; the same in the panel)
  bonoSinBono: 'Este estrato no genera bono. Los estratos S y A sí, si se cumple la meta del grupo.',
  // the expected pace, as a marker on the goal bar: the caption under the bar
  marca: (pct) => `Marca: avance del mes ${pct} %`,
  // the month-end projection (client-side, from the goal's percentage and the pace; an estimate, not the official score)
  proyeccionFin: (x) => (x >= 100 ? 'Proyección para fin de mes: 100 % o más' : `Proyección para fin de mes: ${x} %`),
  proyeccionFinNota: 'Si mantienes el ritmo actual. Es una estimación y no cambia el puntaje oficial.',
  // the local's billing goal, percentages only (owner decision); the same copy as the panel
  metaLocal: (cumplida, faltante) => `Meta del local: ${cumplida} % cumplida · ${faltante} % faltante`,
  metaLocalCumplida: (faltante) => `Meta cumplida · ${faltante} % faltante`,
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
  metaLocal: { cumplidaPct: true, faltantePct: true, cumplida: true, ritmoEsperadoPct: true },   // null when no goal; ritmoEsperadoPct may be null or absent
  isProvisional: true, computedAt: true,
  improvementHints: [{ component: true, text: true }],
  productionProjection: { projectedPoints: true, max: true, basisDays: true, isEstimate: true },
});

// The only keys that may be null: the estimate, and the local goal when no goal is configured. Anything else null is refused.
const ANULABLES = ['.productionProjection', '.metaLocal', '.metaLocal.ritmoEsperadoPct'];
// The keys that may be ABSENT: an answer from an API that does not send the local goal yet (deploy order) shows no block, instead of being refused.
// Absent means "no block"; it never grants access to anything, so the rest of the allowlist stays strict.
const OPCIONALES = ['.metaLocal', '.metaLocal.ritmoEsperadoPct'];

// Every key present and no extra key, at every level. Returns the list of problems (empty = valid).
export function problemasDeForma(obj, forma, ruta = '') {
  if (forma === true) return [];
  if (obj === null) return ANULABLES.includes(ruta) ? [] : [ruta + ' es nulo'];
  if (Array.isArray(forma)) {
    if (!Array.isArray(obj)) return [ruta + ' no es lista'];
    return obj.flatMap((x, i) => problemasDeForma(x, forma[0], ruta + '[' + i + ']'));
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return [ruta + ' no es objeto'];
  const sobran = Object.keys(obj).filter(k => !(k in forma)).map(k => ruta + '.' + k + ' sobra');
  const faltan = Object.keys(forma).filter(k => !(k in obj) && !OPCIONALES.includes(ruta + '.' + k)).map(k => ruta + '.' + k + ' falta');
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
const SIN_BONO = ['B', 'C', 'D', 'X'];

// Projection for the end of the month: X = round(cumplidaPct × 100 / ritmoEsperadoPct), shown capped ("100 % o más").
// Hidden (null) when: the pace is null or not an integer, the pace is 0 (no division), the elapsed scheduled days are unknown or fewer than 3,
// or the goal percentage is not a number. Client-side only; no API change; not the official score.
export function proyeccionFinMes({ cumplidaPct, ritmoEsperadoPct, diasTranscurridos }) {
  if (!Number.isInteger(ritmoEsperadoPct) || ritmoEsperadoPct <= 0 || ritmoEsperadoPct > 100) return null;
  if (!Number.isInteger(diasTranscurridos) || diasTranscurridos < 3) return null;
  if (!Number.isFinite(cumplidaPct) || cumplidaPct < 0) return null;
  const x = Math.round((cumplidaPct * 100) / ritmoEsperadoPct);
  return { pct: Math.min(x, 100), texto: TEXTOS.proyeccionFin(x), nota: TEXTOS.proyeccionFinNota };
}

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
    // tiers without a bonus (B, C, D, X) get the owner-approved sentence; S and A keep the current one
    bonoNota: SIN_BONO.includes(String(dto.bonusTier).toUpperCase()) ? TEXTOS.bonoSinBono : TEXTOS.bono,
    // percentages only: integers, floored in the API; clamped again here so a bar never leaves 0..100. Null → no block.
    metaLocal: dto.metaLocal ? (() => {
      const cum = Math.max(0, Math.min(100, Math.floor(Number(dto.metaLocal.cumplidaPct)) || 0));
      const fal = Math.max(0, Math.min(100, Math.floor(Number(dto.metaLocal.faltantePct)) || 0));
      const cumplida = dto.metaLocal.cumplida === true;
      // the expected pace: an integer 0..100, or nothing (null/undefined from an old server → no marker, no caption)
      const rp = dto.metaLocal.ritmoEsperadoPct;
      const ritmo = Number.isInteger(rp) && rp >= 0 && rp <= 100 ? { pct: rp, texto: TEXTOS.marca(rp) } : null;
      // elapsed scheduled days: only the estimate carries them (productionProjection.basisDays); without them the projection stays hidden
      const dias = dto.productionProjection ? dto.productionProjection.basisDays : null;
      const cumPct = cumplida ? 100 : cum;
      return { cumplida, cumplidaPct: cumPct, faltantePct: cumplida ? 0 : fal,
        texto: cumplida ? TEXTOS.metaLocalCumplida(0) : TEXTOS.metaLocal(cum, fal), ritmo,
        proyeccionFin: proyeccionFinMes({ cumplidaPct: cumPct, ritmoEsperadoPct: rp, diasTranscurridos: dias }) };
    })() : null,
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
  return [v.titulo, v.puntajeTxt, v.maximoTxt, v.tier, v.descalificado, v.tierBono, v.bonoNota, v.metaLocal && v.metaLocal.texto, ...(v.metaLocal && v.metaLocal.ritmo ? [v.metaLocal.ritmo.texto] : []), ...(v.metaLocal && v.metaLocal.proyeccionFin ? [v.metaLocal.proyeccionFin.texto, v.metaLocal.proyeccionFin.nota] : []), v.provisional, v.copiados,
    ...(v.proyeccion ? [v.proyeccion.texto, v.proyeccion.base] : []),
    ...v.puntos.flatMap(p => [p.nombre, p.puntos, p.detalle]),
    ...v.conducta.flatMap(r => [r.etiqueta, r.promedio, r.tendencia]),
    ...v.mejorar].filter(x => typeof x === 'string');
}
