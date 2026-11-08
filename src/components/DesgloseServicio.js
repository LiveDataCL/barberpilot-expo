// Display-only per-service breakdown (see src/services/desgloseServicio.js).
// Renders rows: cobrado / Tu ganancia / [Propina] / Total por el servicio.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants';
import { desgloseServicio } from '../services/desgloseServicio';

const COLOR_POR_TIPO = {
  cobrado: COLORS.text2,
  ganancia: COLORS.ok,
  propina: COLORS.gold,
  total: COLORS.ok,
};

export default function DesgloseServicio({ registro }) {
  const d = desgloseServicio(registro);
  return (
    <View style={s.wrap}>
      {d.filas.map((f) => (
        <View key={f.tipo} style={s.fila}>
          <Text style={[s.lbl, f.tipo === 'total' && s.bold]} numberOfLines={1}>{f.etiqueta}</Text>
          <Text style={[s.val, { color: COLOR_POR_TIPO[f.tipo] }, f.tipo === 'total' && s.bold]}>{f.valor}</Text>
        </View>
      ))}
      {d.resumen ? <Text style={s.resumen}>{d.resumen}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:    { flex: 1, gap: 2 },
  fila:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lbl:     { fontSize: 14, color: COLORS.text, flexShrink: 1, paddingRight: 8 },
  val:     { fontSize: 14, fontWeight: '600', textAlign: 'right' },
  bold:    { fontWeight: '700' },
  resumen: { fontSize: 12, color: COLORS.text3, marginTop: 2 },
});
