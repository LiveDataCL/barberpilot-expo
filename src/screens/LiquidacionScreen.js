import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { COLORS, fmt, hoy } from '../constants';
import { api } from '../services/api';

export default function LiquidacionScreen({ barbero }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const json = await api.hoy(barbero.bid);
      if (json.ok) setData(json);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { cargar(); }, []);

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={COLORS.gold} /></View>
  );

  const regs = data?.registros || [];
  const bb   = data?.a_cobrar  || 0;
  const fact = data?.facturado || 0;
  const n    = data?.servicios || 0;

  // Desglose por pago
  const desglose = { efectivo: 0, debito: 0, transferencia: 0 };
  regs.forEach((r) => {
    const monto = (r.bb || 0) + (r.propina || 0);
    desglose[r.pago] = (desglose[r.pago] || 0) + monto;
  });

  if (n === 0) return (
    <View style={s.center}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>💰</Text>
      <Text style={s.emptyTxt}>Sin servicios registrados hoy</Text>
    </View>
  );

  return (
    <ScrollView
      style={s.scroll} contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); cargar(true); }}
          tintColor={COLORS.gold} colors={[COLORS.gold]} />
      }
    >
      {/* Total a cobrar — protagonista */}
      <View style={s.heroCard}>
        <Text style={s.heroLbl}>TOTAL A COBRAR HOY</Text>
        <Text style={s.heroVal}>${fmt(bb)}</Text>
        <Text style={s.heroSub}>{n} servicios · ${fmt(fact)} facturado</Text>
      </View>

      {/* Desglose por forma de pago */}
      <View style={s.card}>
        <Text style={s.cardTitle}>DESGLOSE POR FORMA DE PAGO</Text>
        {desglose.efectivo > 0 && (
          <View style={s.liqRow}>
            <Text style={s.liqLbl}>💵 Efectivo</Text>
            <Text style={[s.liqVal, { color: COLORS.ok }]}>${fmt(desglose.efectivo)}</Text>
          </View>
        )}
        {desglose.debito > 0 && (
          <View style={s.liqRow}>
            <Text style={s.liqLbl}>💳 Débito</Text>
            <Text style={[s.liqVal, { color: COLORS.blue }]}>${fmt(desglose.debito)}</Text>
          </View>
        )}
        {desglose.transferencia > 0 && (
          <View style={s.liqRow}>
            <Text style={s.liqLbl}>📲 Transferencia</Text>
            <Text style={[s.liqVal, { color: COLORS.gold }]}>${fmt(desglose.transferencia)}</Text>
          </View>
        )}
        <View style={[s.liqRow, s.liqTotal]}>
          <Text style={[s.liqLbl, { fontWeight: '700', color: COLORS.text }]}>Total</Text>
          <Text style={[s.liqVal, { color: COLORS.ok, fontSize: 20 }]}>${fmt(bb)}</Text>
        </View>
      </View>

      {/* Lista servicios */}
      <View style={s.card}>
        <Text style={s.cardTitle}>SERVICIOS DEL DÍA</Text>
        {[...regs].sort((a, b) => (b.ts || 0) - (a.ts || 0)).map((r) => (
          <View key={r.id} style={s.svcRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.svcNom}>{r.snom}</Text>
              <Text style={s.svcHora}>{r.hora?.slice(0,5)} · {r.pago}</Text>
            </View>
            <Text style={s.svcBB}>${fmt(r.bb + (r.propina||0))}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: COLORS.bg },
  content:  { padding: 18, paddingBottom: 40 },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.bg, gap: 8 },
  emptyTxt: { fontSize: 17, color: COLORS.text3 },

  heroCard: { backgroundColor: 'rgba(77,184,122,.09)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(77,184,122,.3)',
    padding: 28, alignItems: 'center', marginBottom: 18 },
  heroLbl:  { fontSize: 11, color: COLORS.text3, letterSpacing: 3,
    textTransform: 'uppercase', marginBottom: 10 },
  heroVal:  { fontSize: 56, color: COLORS.ok, fontWeight: '300',
    fontVariant: ['tabular-nums'], lineHeight: 64 },
  heroSub:  { fontSize: 14, color: COLORS.text2, marginTop: 8 },

  card:     { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 18, marginBottom: 14 },
  cardTitle:{ fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 14 },

  liqRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  liqTotal: { borderBottomWidth: 0, marginTop: 6,
    paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border2 },
  liqLbl:   { fontSize: 16, color: COLORS.text2 },
  liqVal:   { fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },

  svcRow:   { flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  svcNom:   { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  svcHora:  { fontSize: 12, color: COLORS.text3, marginTop: 3 },
  svcBB:    { fontSize: 16, color: COLORS.ok, fontWeight: '600',
    fontVariant: ['tabular-nums'] },
});
