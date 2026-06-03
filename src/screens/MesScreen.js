import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { COLORS, fmt, fmtM, mesPeriodo } from '../constants';
import { api } from '../services/api';
import { getMetaBarbero } from '../services/metas';

export default function MesScreen({ barbero }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const json = await api.mes(barbero.bid, mesPeriodo());
      if (json.ok) setData(json);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { cargar(); }, []);

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={COLORS.gold} /></View>
  );

  const n    = data?.servicios   || 0;
  const fact = data?.facturado   || 0;
  const bb   = data?.a_cobrar    || 0;
  const tk   = data?.ticket_prom || 0;
  const ups  = data?.upselling   || 0;
  const regs = data?.registros   || [];

  const META     = getMetaBarbero('mes');
  const avgTk    = tk || 13000;
  const metaSvc  = Math.max(1, Math.round(META / avgTk));
  const pct      = Math.min(100, Math.round(bb / META * 100));
  const falta    = Math.max(0, META - bb);

  // Servicios por tipo
  const svcMap = {};
  regs.forEach((r) => { svcMap[r.snom] = (svcMap[r.snom] || 0) + 1; });
  const topSvc = Object.entries(svcMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); cargar(true); }}
          tintColor={COLORS.gold} colors={[COLORS.gold]} />
      }
    >
      {/* Header mes */}
      <Text style={s.mesTitle}>{mesPeriodo()}</Text>

      {/* Stats */}
      <View style={s.grid2}>
        <View style={s.statCard}>
          <Text style={s.statVal}>{n}</Text>
          <Text style={s.statLbl}>Servicios</Text>
        </View>
        <View style={[s.statCard, s.statGold]}>
          <Text style={[s.statVal, { color: COLORS.gold }]}>${fmt(tk)}</Text>
          <Text style={s.statLbl}>Ticket prom.</Text>
        </View>
        <View style={[s.statCard, s.statGreen]}>
          <Text style={[s.statVal, { color: COLORS.ok }]}>{fmtM(bb)}</Text>
          <Text style={s.statLbl}>Mis ingresos</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statVal}>{ups}</Text>
          <Text style={s.statLbl}>Upselling</Text>
        </View>
      </View>

      {/* Progreso meta */}
      <View style={s.card}>
        <Text style={s.cardTitle}>PROGRESO HACIA LA META</Text>
        <View style={s.metaRow}>
          <Text style={[s.metaVal, { color: COLORS.ok }]}>{fmtM(bb)}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.metaTotal}>Meta: {fmtM(META)}</Text>
            <Text style={[s.metaTotal, { marginTop: 2 }]}>{n} / {metaSvc} servicios</Text>
          </View>
        </View>
        <View style={s.barBg}>
          <View style={[s.barFill, {
            width: `${pct}%`,
            backgroundColor: pct >= 100 ? COLORS.ok : COLORS.gold,
          }]} />
        </View>
        <Text style={s.barPct}>{pct}% completado</Text>
        {bb < META ? (
          <Text style={s.barFalta}>Faltan <Text style={{ color: COLORS.red }}>${fmt(falta)}</Text></Text>
        ) : (
          <Text style={[s.barFalta, { color: COLORS.ok }]}>🎉 ¡Meta superada!</Text>
        )}
      </View>

      {/* Top servicios */}
      {topSvc.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>MIS SERVICIOS DEL MES</Text>
          {topSvc.map(([nom, cnt]) => {
            const pctSvc = n > 0 ? Math.round(cnt / n * 100) : 0;
            return (
              <View key={nom} style={{ marginBottom: 12 }}>
                <View style={s.svcTopRow}>
                  <Text style={s.svcTopNom} numberOfLines={1}>{nom}</Text>
                  <Text style={s.svcTopCnt}>{cnt} ({pctSvc}%)</Text>
                </View>
                <View style={s.barBg}>
                  <View style={[s.barFill, {
                    width: `${pctSvc}%`, backgroundColor: COLORS.gold3, height: 4,
                  }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: COLORS.bg },
  content:  { padding: 18, paddingBottom: 32 },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  mesTitle: { fontSize: 13, color: COLORS.gold, letterSpacing: 3,
    textTransform: 'uppercase', marginBottom: 16 },

  grid2:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: COLORS.s2, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 18 },
  statGreen:{ backgroundColor: 'rgba(77,184,122,.07)', borderColor: 'rgba(77,184,122,.2)' },
  statGold: { backgroundColor: 'rgba(201,168,76,.07)', borderColor: 'rgba(201,168,76,.2)' },
  statVal:  { fontSize: 26, color: COLORS.text, fontWeight: '500' },
  statLbl:  { fontSize: 12, color: COLORS.text3, marginTop: 4,
    textTransform: 'uppercase', letterSpacing: 1 },

  card:     { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 18, marginBottom: 14 },
  cardTitle:{ fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 14 },

  metaRow:  { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'baseline', marginBottom: 10 },
  metaVal:  { fontSize: 24, fontWeight: '600' },
  metaTotal:{ fontSize: 13, color: COLORS.text3 },

  barBg:    { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
  barFill:  { height: 8, borderRadius: 4 },
  barPct:   { fontSize: 13, color: COLORS.text2, marginTop: 8 },
  barFalta: { fontSize: 13, color: COLORS.text3, marginTop: 4 },

  svcTopRow:{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  svcTopNom:{ fontSize: 14, color: COLORS.text, flex: 1 },
  svcTopCnt:{ fontSize: 13, color: COLORS.text3, fontVariant: ['tabular-nums'] },
});
