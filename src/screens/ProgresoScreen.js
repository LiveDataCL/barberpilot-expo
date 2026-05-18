import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { COLORS, fmt, fmtM, mesPeriodo } from '../constants';
import { api } from '../services/api';

const { width } = Dimensions.get('window');

// Calcular los últimos 4 meses
function ultimosMeses(n = 4) {
  const meses = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    meses.unshift(`${y}-${m}`);
    d.setMonth(d.getMonth() - 1);
  }
  return meses;
}

const NOMBRES_MES = [
  'Ene','Feb','Mar','Abr','May','Jun',
  'Jul','Ago','Sep','Oct','Nov','Dic',
];

function labelMes(periodo) {
  const [, m] = periodo.split('-');
  return NOMBRES_MES[parseInt(m) - 1];
}

export default function ProgresoScreen({ barbero }) {
  const [datos, setDatos]     = useState({}); // { 'YYYY-MM': { bb, svc, tk } }
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const periodos = ultimosMeses(4);
  const actual   = mesPeriodo();

  const cargar = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const results = await Promise.all(
        periodos.map((p) => api.mes(barbero.bid, p).catch(() => null))
      );
      const map = {};
      periodos.forEach((p, i) => {
        const r = results[i];
        if (r?.ok) {
          map[p] = {
            bb:  r.a_cobrar   || 0,
            svc: r.servicios  || 0,
            tk:  r.ticket_prom|| 0,
            fact:r.facturado  || 0,
          };
        } else {
          map[p] = { bb: 0, svc: 0, tk: 0, fact: 0 };
        }
      });
      setDatos(map);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { cargar(); }, []);

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={COLORS.gold} /></View>
  );

  const maxBB  = Math.max(...periodos.map((p) => datos[p]?.bb  || 0), 1);
  const maxSvc = Math.max(...periodos.map((p) => datos[p]?.svc || 0), 1);

  // Variación mes actual vs mes anterior
  const mesActual  = datos[periodos[periodos.length - 1]] || {};
  const mesAnterior= datos[periodos[periodos.length - 2]] || {};
  const varBB  = mesAnterior.bb  > 0 ? Math.round((mesActual.bb  - mesAnterior.bb)  / mesAnterior.bb  * 100) : null;
  const varSvc = mesAnterior.svc > 0 ? Math.round((mesActual.svc - mesAnterior.svc) / mesAnterior.svc * 100) : null;
  const varTk  = mesAnterior.tk  > 0 ? Math.round((mesActual.tk  - mesAnterior.tk)  / mesAnterior.tk  * 100) : null;

  const colorVar = (v) => v == null ? COLORS.text3 : v >= 0 ? COLORS.ok : COLORS.red;
  const fmtVar   = (v) => v == null ? '—' : (v >= 0 ? '+' : '') + v + '%';

  return (
    <ScrollView
      style={s.scroll} contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); cargar(true); }}
          tintColor={COLORS.gold} colors={[COLORS.gold]} />
      }
    >
      <Text style={s.titulo}>TU PROGRESO · ÚLTIMOS 4 MESES</Text>

      {/* Variación vs mes anterior */}
      <View style={s.varRow}>
        <View style={[s.varCard, s.varGreen]}>
          <Text style={s.varLbl}>Ingresos</Text>
          <Text style={[s.varVal, { color: colorVar(varBB) }]}>{fmtVar(varBB)}</Text>
          <Text style={s.varSub}>vs mes anterior</Text>
        </View>
        <View style={s.varCard}>
          <Text style={s.varLbl}>Servicios</Text>
          <Text style={[s.varVal, { color: colorVar(varSvc) }]}>{fmtVar(varSvc)}</Text>
          <Text style={s.varSub}>vs mes anterior</Text>
        </View>
        <View style={s.varCard}>
          <Text style={s.varLbl}>Ticket</Text>
          <Text style={[s.varVal, { color: colorVar(varTk) }]}>{fmtVar(varTk)}</Text>
          <Text style={s.varSub}>vs mes anterior</Text>
        </View>
      </View>

      {/* Gráfica de barras — Ingresos */}
      <View style={s.card}>
        <Text style={s.cardTitle}>INGRESOS POR MES</Text>
        <View style={s.barChart}>
          {periodos.map((p) => {
            const v    = datos[p]?.bb || 0;
            const pct  = maxBB > 0 ? v / maxBB : 0;
            const isNow= p === actual;
            const barH = Math.max(4, Math.round(pct * 140));
            return (
              <View key={p} style={s.barCol}>
                <Text style={[s.barTopVal, { color: isNow ? COLORS.ok : COLORS.text2 }]}>
                  {v > 0 ? fmtM(v) : '—'}
                </Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, {
                    height: barH,
                    backgroundColor: isNow ? COLORS.ok : COLORS.gold3,
                    borderTopLeftRadius: 4, borderTopRightRadius: 4,
                  }]} />
                </View>
                <Text style={[s.barLabel, isNow && { color: COLORS.gold, fontWeight: '700' }]}>
                  {labelMes(p)}
                </Text>
                {isNow && <View style={s.barDot} />}
              </View>
            );
          })}
        </View>
      </View>

      {/* Gráfica — Servicios */}
      <View style={s.card}>
        <Text style={s.cardTitle}>SERVICIOS POR MES</Text>
        <View style={s.barChart}>
          {periodos.map((p) => {
            const v    = datos[p]?.svc || 0;
            const pct  = maxSvc > 0 ? v / maxSvc : 0;
            const isNow= p === actual;
            const barH = Math.max(4, Math.round(pct * 140));
            return (
              <View key={p} style={s.barCol}>
                <Text style={[s.barTopVal, { color: isNow ? COLORS.gold : COLORS.text2 }]}>
                  {v > 0 ? v : '—'}
                </Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, {
                    height: barH,
                    backgroundColor: isNow ? COLORS.gold : COLORS.gold3,
                    borderTopLeftRadius: 4, borderTopRightRadius: 4,
                  }]} />
                </View>
                <Text style={[s.barLabel, isNow && { color: COLORS.gold, fontWeight: '700' }]}>
                  {labelMes(p)}
                </Text>
                {isNow && <View style={[s.barDot, { backgroundColor: COLORS.gold }]} />}
              </View>
            );
          })}
        </View>
      </View>

      {/* Tabla detalle */}
      <View style={s.card}>
        <Text style={s.cardTitle}>DETALLE POR MES</Text>
        {/* Header */}
        <View style={[s.tableRow, s.tableHead]}>
          <Text style={[s.cell0, s.headTxt]}>Mes</Text>
          <Text style={[s.cell1, s.headTxt]}>Svc</Text>
          <Text style={[s.cell2, s.headTxt]}>Ticket</Text>
          <Text style={[s.cell3, s.headTxt]}>Ingresos</Text>
        </View>
        {[...periodos].reverse().map((p) => {
          const d     = datos[p] || {};
          const isNow = p === actual;
          return (
            <View key={p} style={[s.tableRow, isNow && s.tableRowNow]}>
              <Text style={[s.cell0, isNow && { color: COLORS.gold, fontWeight: '700' }]}>
                {labelMes(p)} {p.split('-')[0].slice(2)}
                {isNow ? ' ●' : ''}
              </Text>
              <Text style={[s.cell1, { color: COLORS.text2 }]}>{d.svc || '—'}</Text>
              <Text style={[s.cell2, { color: COLORS.text2 }]}>
                {d.tk ? `$${fmt(d.tk)}` : '—'}
              </Text>
              <Text style={[s.cell3, { color: isNow ? COLORS.ok : COLORS.text }]}>
                {d.bb ? fmtM(d.bb) : '—'}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Mejor mes */}
      {(() => {
        const mejorP = periodos.reduce((a, p) =>
          (datos[p]?.bb || 0) > (datos[a]?.bb || 0) ? p : a, periodos[0]);
        const mejorD = datos[mejorP] || {};
        if (!mejorD.bb) return null;
        return (
          <View style={s.mejorCard}>
            <Text style={s.mejorIco}>🏅</Text>
            <View>
              <Text style={s.mejorLbl}>Tu mejor mes</Text>
              <Text style={s.mejorVal}>
                {labelMes(mejorP)} · {fmtM(mejorD.bb)}
              </Text>
              <Text style={s.mejorSub}>
                {mejorD.svc} servicios · ticket ${fmt(mejorD.tk)}
              </Text>
            </View>
          </View>
        );
      })()}

    </ScrollView>
  );
}

const BAR_W = (width - 36 - 48) / 4; // 4 barras

const s = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 18, paddingBottom: 40 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  titulo:  { fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 16 },

  // Variación
  varRow:  { flexDirection: 'row', gap: 8, marginBottom: 16 },
  varCard: { flex: 1, backgroundColor: COLORS.s2, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, alignItems: 'center' },
  varGreen:{ backgroundColor: 'rgba(77,184,122,.07)',
    borderColor: 'rgba(77,184,122,.2)' },
  varLbl:  { fontSize: 11, color: COLORS.text3, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 6 },
  varVal:  { fontSize: 22, fontWeight: '600' },
  varSub:  { fontSize: 10, color: COLORS.text3, marginTop: 4, textAlign: 'center' },

  // Gráficas
  card:    { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 18, marginBottom: 14 },
  cardTitle: { fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 18 },

  barChart: { flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-around', height: 200 },
  barCol:   { alignItems: 'center', width: BAR_W },
  barTopVal:{ fontSize: 11, fontWeight: '600', marginBottom: 6,
    textAlign: 'center' },
  barTrack: { width: BAR_W * 0.55, height: 140,
    justifyContent: 'flex-end', alignItems: 'stretch' },
  barFill:  { width: '100%' },
  barLabel: { fontSize: 13, color: COLORS.text3, marginTop: 8, fontWeight: '500' },
  barDot:   { width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.ok, marginTop: 4 },

  // Tabla
  tableRow:  { flexDirection: 'row', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableHead: { borderBottomWidth: 1, borderBottomColor: COLORS.border2 },
  tableRowNow:{ backgroundColor: 'rgba(201,168,76,.05)',
    borderRadius: 8, marginHorizontal: -4, paddingHorizontal: 4 },
  headTxt:   { fontSize: 11, color: COLORS.text3, letterSpacing: 1,
    textTransform: 'uppercase', fontWeight: '600' },
  cell0: { flex: 1.2, fontSize: 14, color: COLORS.text },
  cell1: { flex: 0.7, fontSize: 14, textAlign: 'center' },
  cell2: { flex: 1.2, fontSize: 14, textAlign: 'center' },
  cell3: { flex: 1.2, fontSize: 14, textAlign: 'right', fontWeight: '600' },

  // Mejor mes
  mejorCard: { backgroundColor: 'rgba(201,168,76,.08)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(201,168,76,.25)',
    padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  mejorIco:  { fontSize: 36 },
  mejorLbl:  { fontSize: 11, color: COLORS.gold3, letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 4 },
  mejorVal:  { fontSize: 18, color: COLORS.gold, fontWeight: '600' },
  mejorSub:  { fontSize: 13, color: COLORS.text3, marginTop: 3 },
});
