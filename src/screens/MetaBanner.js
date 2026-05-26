import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, fmt, fmtM } from '../constants';

const METAS = {
  hoy:    { svc: 6,   fact: 62500   },
  semana: { svc: 31,  fact: 375000  },
  mes:    { svc: 135, fact: 1625000 },
};

const ETIQUETA = { hoy: 'DÍA', semana: 'SEMANA', mes: 'MES' };

export default function MetaBanner({ periodo, svc, fact }) {
  const meta = METAS[periodo];
  if (!meta) return null;

  const pctSvc  = Math.min(svc  / meta.svc  * 100, 100);
  const pctFact = Math.min(fact / meta.fact * 100, 100);
  const pctAvg  = Math.round((pctSvc + pctFact) / 2);

  const animSvc  = useRef(new Animated.Value(0)).current;
  const animFact = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animSvc,  { toValue: pctSvc,  duration: 700, useNativeDriver: false }),
      Animated.timing(animFact, { toValue: pctFact, duration: 700, useNativeDriver: false }),
    ]).start();
  }, [svc, fact, periodo]);

  const barColor = (pct) =>
    pct >= 100 ? COLORS.ok : pct >= 60 ? COLORS.gold : 'rgba(201,168,76,.4)';

  const faltaSvc  = Math.max(meta.svc - svc, 0);
  const faltaFact = Math.max(meta.fact - fact, 0);
  const fmtVal    = (v) => v >= 100000 ? fmtM(v) : '$' + fmt(v);

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.titulo}>META {ETIQUETA[periodo]}</Text>
        <Text style={[s.pct, pctAvg >= 100 && { color: COLORS.ok }]}>
          {pctAvg}%
        </Text>
      </View>

      <View style={s.fila}>
        <View style={s.filaHead}>
          <Text style={s.filaLbl}>✂️ Servicios</Text>
          <Text style={s.filaNum}>{svc} / {meta.svc}</Text>
        </View>
        <View style={s.barBg}>
          <Animated.View style={[s.barFill, {
            width: animSvc.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            backgroundColor: barColor(pctSvc),
          }]} />
        </View>
        {faltaSvc > 0 && <Text style={s.falta}>Faltan {faltaSvc} svc</Text>}
      </View>

      <View style={[s.fila, { marginBottom: 0 }]}>
        <View style={s.filaHead}>
          <Text style={s.filaLbl}>💰 Facturado</Text>
          <Text style={s.filaNum}>{fmtVal(fact)} / {fmtVal(meta.fact)}</Text>
        </View>
        <View style={s.barBg}>
          <Animated.View style={[s.barFill, {
            width: animFact.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            backgroundColor: barColor(pctFact),
          }]} />
        </View>
        {faltaFact > 0 && <Text style={s.falta}>Faltan {fmtVal(faltaFact)}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card:     { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 16, marginBottom: 14 },
  head:     { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14 },
  titulo:   { fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase' },
  pct:      { fontSize: 22, color: COLORS.gold, fontWeight: '700' },

  fila:     { marginBottom: 12 },
  filaHead: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6 },
  filaLbl:  { fontSize: 13, color: COLORS.text2 },
  filaNum:  { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  barBg:    { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  barFill:  { height: 8, borderRadius: 4 },
  falta:    { fontSize: 11, color: COLORS.text3, marginTop: 4, textAlign: 'right' },
});
