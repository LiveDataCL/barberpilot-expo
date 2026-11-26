// "Mi evaluación": the barber's own evaluation of the current month, read-only, on the Config tab (segmented control "Perfil" / "Mi evaluación").
// Data: GET /api/v2/me/evaluation (the session decides whose data; the API ignores any barber or month parameter). No month selector.
// States: loading; ok (with "Actualizado: hh:mm"); offline (last good answer with "sin conexión — datos de hh:mm"); no evaluation; error.
// Pull to refresh. The last good answer is cached on the device (src/services/evaluacionCache.js).
// Type: Montserrat (loaded by App.js) at 400/500/700. Minimum sizes: 13 for secondary text, 15 for body, 14 for status lines.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants';
import { fetchAutenticado } from '../services/api';
import { TEXTOS, resolverEstado, vistaDe, mesDe } from '../services/evaluacion';
import { leerCache, guardarCache, borrarCache } from '../services/evaluacionCache';

const TIMEOUT_MS = 10000;
const REG = 'Montserrat_400Regular';
const MED = 'Montserrat_500Medium';
const BOLD = 'Montserrat_700Bold';

export default function MiEvaluacion({ barbero }) {
  const [estado, setEstado] = useState(null);
  const [refrescando, setRefrescando] = useState(false);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const cargar = useCallback(async () => {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
    let status = null, cuerpo = null, redErr = false;
    try {
      const r = await fetchAutenticado('/api/v2/me/evaluation', { signal: control.signal });
      status = r.status;
      cuerpo = await r.json().catch(() => null);
    } catch {
      redErr = true;
    }
    clearTimeout(reloj);
    const cache = await leerCache(barbero.bid);
    const r = resolverEstado({ status, cuerpo, redErr, cache, mesActual: mesDe() });
    if (r.guardar) await guardarCache(barbero.bid, r.dto);
    if (r.borrarCache) await borrarCache(barbero.bid);
    if (!vivo.current) return;
    setEstado(r);
    setRefrescando(false);
  }, [barbero.bid]);

  useEffect(() => { cargar(); }, [cargar]);

  const onRefresh = () => { setRefrescando(true); cargar(); };
  const refresh = <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={COLORS.gold} colors={[COLORS.gold]} />;

  if (!estado) {
    return (
      <View style={s.centro}><ActivityIndicator color={COLORS.gold} size="large" /></View>
    );
  }

  if (estado.tipo === 'sin_evaluacion' || estado.tipo === 'sesion' || estado.tipo === 'error') {
    return (
      <ScrollView style={s.scroll} contentContainerStyle={s.contenido} refreshControl={refresh}>
        <View style={s.aviso} accessibilityRole="alert">
          <Text style={s.avisoTxt}>{estado.mensaje}</Text>
        </View>
      </ScrollView>
    );
  }

  const v = vistaDe(estado.dto);
  const ritmo = v.metaLocal ? v.metaLocal.ritmo : null;   // null or undefined from an old server: no marker, no caption
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.contenido} refreshControl={refresh}>
      {estado.tipo === 'sin_conexion' ? (
        <View style={s.sinConexion} accessibilityRole="alert">
          <Text style={s.sinConexionTxt}>{TEXTOS.sinConexion} {estado.hora}</Text>
        </View>
      ) : (
        <Text style={s.actualizado}>{TEXTOS.actualizado}: {estado.hora}</Text>
      )}
      <View style={s.fila}>
        <Text style={s.provisional}>{v.provisional}</Text>
      </View>

      <View style={s.puntajeBloque}>
        <Text style={s.puntaje}>{v.puntajeTxt}<Text style={s.puntajeMax}> {v.maximoTxt}</Text></Text>
        <View style={s.tier}><Text style={s.tierTxt}>{v.tier}</Text></View>
      </View>
      <Text style={s.bono}>{v.tierBono}</Text>
      <Text style={s.bonoNota}>{v.bonoNota}</Text>
      {v.metaLocal ? (
        <View style={s.metaLocal}>
          <Text style={s.metaLocalTxt}>{v.metaLocal.texto}</Text>
          <View style={s.barraWrap}>
            <View style={s.barra} accessibilityRole="progressbar" accessibilityLabel={v.metaLocal.texto}
              accessibilityValue={{ min: 0, max: 100, now: v.metaLocal.cumplidaPct }}>
              <View style={[s.barraRelleno, { width: v.metaLocal.cumplidaPct + '%' }, v.metaLocal.cumplida && s.barraOk]} />
            </View>
            {ritmo ? (
              // the expected-pace tick: light, 3 px wide, taller than the bar; its meaning is also written in the caption below
              <View style={[s.ritmoMarca, { left: ritmo.pct + '%' }]} importantForAccessibility="no" />
            ) : null}
          </View>
          {ritmo ? (
            <View style={s.ritmoBloque}>
              <Text style={s.ritmoTxt}>{ritmo.texto}</Text>
            </View>
          ) : null}
          {v.metaLocal.proyeccionFin ? (
            <View style={s.proyFinBloque} accessibilityRole="text">
              <Text style={s.proyFinTxt}>{v.metaLocal.proyeccionFin.texto}</Text>
              <Text style={s.proyFinNota}>{v.metaLocal.proyeccionFin.nota}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {v.descalificado ? (
        <View style={s.disq} accessibilityRole="alert"><Text style={s.disqTxt}>{v.descalificado}</Text></View>
      ) : null}

      {v.proyeccion ? (
        <View style={s.proyeccion}>
          <Text style={s.proyeccionTxt}>{v.proyeccion.texto}</Text>
          <Text style={s.proyeccionBase}>{v.proyeccion.base}</Text>
        </View>
      ) : null}

      <View style={s.bloque}>
        <Text style={s.seccion}>{TEXTOS.seccionPuntaje}</Text>
        {v.puntos.map(p => (
          <View key={p.clave} style={s.filaPunto}>
            <View style={{ flex: 1 }}>
              <Text style={s.punto}>{p.nombre}</Text>
              {p.detalle ? <Text style={s.detalle}>{p.detalle}</Text> : null}
            </View>
            <Text style={s.puntoNum}>{p.puntos}</Text>
          </View>
        ))}
      </View>

      <View style={s.bloque}>
        <Text style={s.seccion}>{TEXTOS.seccionConducta}</Text>
        {v.conducta.length === 0 ? <Text style={s.detalle}>{TEXTOS.sinIndicadores}</Text> : null}
        {v.conducta.map(r => (
          <View key={r.etiqueta} style={s.filaPunto}>
            <Text style={[s.punto, { flex: 1 }]}>{r.etiqueta}</Text>
            <Text style={s.puntoNum}>{r.promedio}</Text>
            <Text style={[s.tend, s['tend_' + r.tendenciaClave]]}>{r.tendencia}</Text>
          </View>
        ))}
        <Text style={s.detalle}>{v.copiados}</Text>
      </View>

      {v.mejorar.length > 0 ? (
        <View style={s.bloque}>
          <Text style={s.seccion}>{TEXTOS.seccionMejorar}</Text>
          {v.mejorar.map((t, i) => <Text key={i} style={s.mejora}>• {t}</Text>)}
        </View>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.bg },
  contenido: { padding: 16, paddingBottom: 32 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  actualizado: { fontSize: 13, fontFamily: REG, color: COLORS.text2, marginBottom: 8 },
  sinConexion: { backgroundColor: '#3a2f10', borderColor: COLORS.gold3, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10 },
  sinConexionTxt: { color: COLORS.gold2, fontSize: 14, fontFamily: BOLD },
  aviso: { backgroundColor: COLORS.s1, borderColor: COLORS.border, borderWidth: 1, borderRadius: 10, padding: 18, marginTop: 8 },
  avisoTxt: { color: COLORS.text, fontSize: 16, fontFamily: REG },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  provisional: { fontSize: 13, fontFamily: MED, color: COLORS.gold2, backgroundColor: COLORS.s2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' },
  puntajeBloque: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  puntaje: { fontSize: 40, fontFamily: BOLD, color: COLORS.gold2 },
  puntajeMax: { fontSize: 16, fontFamily: MED, color: COLORS.text2 },
  tier: { backgroundColor: COLORS.s2, borderColor: COLORS.border2, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  tierTxt: { fontSize: 18, fontFamily: BOLD, color: COLORS.text },
  bono: { fontSize: 15, fontFamily: MED, color: COLORS.text },
  bonoNota: { fontSize: 13, fontFamily: REG, color: COLORS.text2, marginBottom: 6 },
  metaLocal: { marginBottom: 12 },
  metaLocalTxt: { fontSize: 15, fontFamily: MED, color: COLORS.text, marginBottom: 6 },
  barraWrap: { position: 'relative' },
  barra: { height: 10, borderRadius: 999, backgroundColor: COLORS.s2, borderColor: COLORS.border2, borderWidth: 1, overflow: 'hidden' },
  barraRelleno: { height: '100%', backgroundColor: COLORS.gold },
  barraOk: { backgroundColor: COLORS.ok },
  // the tick sits outside the bar's clipping box, so it can rise above and below the bar
  ritmoMarca: { position: 'absolute', top: -4, bottom: -4, width: 3, marginLeft: -1.5, backgroundColor: COLORS.text, borderRadius: 2 },
  ritmoBloque: { marginTop: 8 },
  ritmoTxt: { fontSize: 13, fontFamily: MED, color: COLORS.text },
  proyFinBloque: { marginTop: 8 },
  proyFinTxt: { fontSize: 15, fontFamily: MED, color: COLORS.text },
  proyFinNota: { fontSize: 13, fontFamily: REG, color: COLORS.text2, marginTop: 2 },
  disq: { backgroundColor: '#3a1414', borderColor: '#7a2a2a', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  disqTxt: { color: '#f5b5b5', fontSize: 14, fontFamily: BOLD },
  proyeccion: { backgroundColor: COLORS.s1, borderColor: COLORS.border2, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, padding: 12, marginBottom: 12 },
  proyeccionTxt: { color: COLORS.text, fontSize: 15, fontFamily: REG },
  proyeccionBase: { color: COLORS.text2, fontSize: 13, fontFamily: REG, marginTop: 4 },
  bloque: { backgroundColor: COLORS.s1, borderColor: COLORS.border, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  seccion: { fontSize: 13, fontFamily: BOLD, color: COLORS.text2, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  filaPunto: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8, borderBottomColor: COLORS.border, borderBottomWidth: StyleSheet.hairlineWidth },
  punto: { fontSize: 15, fontFamily: REG, color: COLORS.text },
  detalle: { fontSize: 13, fontFamily: REG, color: COLORS.text2, marginTop: 2 },
  puntoNum: { fontSize: 15, fontFamily: MED, color: COLORS.text, fontVariant: ['tabular-nums'], minWidth: 64, textAlign: 'right' },
  tend: { fontSize: 13, fontFamily: MED, minWidth: 96, textAlign: 'right' },
  tend_up: { color: COLORS.ok }, tend_down: { color: COLORS.red }, tend_flat: { color: COLORS.text2 }, tend_insufficient: { color: COLORS.text3 },
  mejora: { fontSize: 15, fontFamily: REG, color: COLORS.text, marginBottom: 6 },
});
