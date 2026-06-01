import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, fmt } from '../constants';
import { api } from '../services/api';

// El app usa bid:'b1'-'b4', la cola usa barber_id:'emerson'|'samuel'|'didian'|'david'
const queueId = (barbero) => barbero.nombre.toLowerCase();

// ── Timer de tiempo transcurrido (actualiza cada 10 s) ────────
function ElapsedTimer({ serviceStart }) {
  const [mins, setMins] = useState(0);

  useEffect(() => {
    if (!serviceStart) return;
    const update = () =>
      setMins(Math.floor((Date.now() - new Date(serviceStart).getTime()) / 60000));
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, [serviceStart]);

  return <Text style={s.elapsedNum}>{mins} min</Text>;
}

// ── Pantalla principal ─────────────────────────────────────────
export default function ColaScreen({ barbero }) {
  const barberId = queueId(barbero);

  const [queue,       setQueue]       = useState([]);
  const [hoyData,     setHoyData]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [pending,     setPending]     = useState(new Set());
  const [toastMsg,    setToastMsg]    = useState('');
  const toastTimer = useRef(null);

  // ── Toast temporal ──────────────────────────────────────────
  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(''), 3500);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // ── Carga de datos ──────────────────────────────────────────
  const cargar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [qData, hData] = await Promise.all([
        api.queue(barberId),
        api.hoy(barbero.bid),
      ]);
      if (qData?.ok)  setQueue(qData.queue || []);
      if (hData?.ok)  setHoyData(hData);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [barberId, barbero.bid]);

  // Montaje + polling cada 20 s
  useEffect(() => {
    cargar();
    const id = setInterval(() => cargar(true), 20000);
    return () => clearInterval(id);
  }, [cargar]);

  // ── Datos derivados ─────────────────────────────────────────
  const inService   = queue.find(e => e.status === 'IN_SERVICE');
  const activeQueue = queue
    .filter(e => e.status === 'WAITING' || e.status === 'IMMINENT')
    .sort((a, b) => (a.queue_position || 0) - (b.queue_position || 0));

  // Stats del footer
  const completados  = hoyData?.servicios || 0;
  const facturado    = hoyData?.facturado  || 0;
  const ticketProm   = completados > 0 ? Math.round(facturado / completados) : 0;

  // ── Toggle disponibilidad ───────────────────────────────────
  const handleToggle = async () => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}

    if (isAvailable) {
      // Disponible → No disponible
      const confirmar = () => setIsAvailable(false);
      if (inService) {
        Alert.alert(
          '¿Seguro?',
          'Hay un cliente en servicio activo.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Confirmar', style: 'destructive', onPress: confirmar },
          ]
        );
      } else {
        confirmar();
      }
    } else {
      // No disponible → Disponible
      setIsAvailable(true);
      const next = activeQueue[0];
      if (next) {
        try {
          await api.notify(next.id, 'YOUR_TURN');
          showToast(`WhatsApp enviado a ${next.client_name}`);
        } catch {}
      }
    }
  };

  // ── Acciones de cola ────────────────────────────────────────
  const addPending    = (id) => setPending(p => new Set([...p, id]));
  const removePending = (id) => setPending(p => { const n = new Set(p); n.delete(id); return n; });

  const handleIniciar = async (entry) => {
    addPending(entry.id);
    try {
      await api.updateStatus(entry.id, 'IN_SERVICE');
      await cargar(true);
    } catch {
      Alert.alert('Error', 'No se pudo iniciar el servicio. Intenta de nuevo.');
    } finally {
      removePending(entry.id);
    }
  };

  const handleCompletar = async (entry) => {
    addPending(entry.id);
    try {
      await api.updateStatus(entry.id, 'DONE');
      try { await api.notify(entry.id, 'POST_SERVICE'); } catch {}
      await cargar(true);
    } catch {
      Alert.alert('Error', 'No se pudo completar el servicio. Intenta de nuevo.');
    } finally {
      removePending(entry.id);
    }
  };

  // ── Loading inicial ─────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(true); }}
            tintColor={COLORS.gold}
            colors={[COLORS.gold]}
          />
        }
      >
        {/* ── Toggle disponibilidad ── */}
        <TouchableOpacity
          style={[s.toggle, isAvailable ? s.toggleOn : s.toggleOff]}
          onPress={handleToggle}
          activeOpacity={0.75}
        >
          <View style={[s.toggleDot, { backgroundColor: isAvailable ? COLORS.ok : COLORS.gold3 }]} />
          <View style={{ flex: 1 }}>
            <Text style={[s.toggleLabel, { color: isAvailable ? COLORS.ok : COLORS.gold }]}>
              {isAvailable ? 'Disponible' : 'No disponible'}
            </Text>
            <Text style={s.toggleSub}>
              {isAvailable
                ? 'Toca para pausar tu cola'
                : 'Toca para reactivar y notificar al siguiente'}
            </Text>
          </View>
          <Text style={[s.toggleArrow, { color: isAvailable ? COLORS.ok : COLORS.gold3 }]}>
            {isAvailable ? '✓' : '⏸'}
          </Text>
        </TouchableOpacity>

        {/* ── Cliente en servicio ── */}
        {inService && (
          <View style={s.inServiceCard}>
            <Text style={s.inServiceLabel}>EN SERVICIO AHORA</Text>
            <View style={s.inServiceRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.inServiceName}>{inService.client_name}</Text>
                <Text style={s.inServiceSvc}>{inService.service}</Text>
                {inService.drink && (
                  <Text style={s.inServiceDrink}>☕ {inService.drink}</Text>
                )}
              </View>
              <View style={s.elapsedBlock}>
                <ElapsedTimer serviceStart={inService.service_start} />
                <Text style={s.elapsedLbl}>transcurrido</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[s.btn, s.btnCompletar, pending.has(inService.id) && s.btnDisabled]}
              onPress={() => handleCompletar(inService)}
              disabled={pending.has(inService.id)}
            >
              <Text style={s.btnCompletarTxt}>
                {pending.has(inService.id) ? 'Procesando…' : '✅  Completar servicio'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Sección cola ── */}
        <Text style={s.sectionLabel}>
          MI COLA · {activeQueue.length}{' '}
          {activeQueue.length === 1 ? 'cliente' : 'clientes'}
        </Text>

        {activeQueue.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIco}>✂️</Text>
            <Text style={s.emptyTxt}>Sin clientes en espera</Text>
          </View>
        ) : (
          activeQueue.map(entry => {
            const isImminent = entry.status === 'IMMINENT';
            const isPending  = pending.has(entry.id);
            return (
              <View
                key={entry.id}
                style={[s.queueCard, isImminent && s.queueCardImminent]}
              >
                {/* Fila superior */}
                <View style={s.queueTop}>
                  <View style={[s.posCircle, isImminent && s.posCircleImminent]}>
                    <Text style={[s.posNum, isImminent && { color: COLORS.gold }]}>
                      {entry.queue_position || '—'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.clientName}>{entry.client_name}</Text>
                    <Text style={s.clientSvc}>{entry.service}</Text>
                  </View>
                  <View style={[s.statusBadge, isImminent ? s.badgeImminent : s.badgeWaiting]}>
                    <Text style={[s.statusTxt, isImminent ? s.statusImminent : s.statusWaiting]}>
                      {isImminent ? '🔔 Próximo' : '⏳ En espera'}
                    </Text>
                  </View>
                </View>

                {/* Chips de detalle */}
                <View style={s.chips}>
                  {entry.drink ? (
                    <View style={s.chip}>
                      <Text style={s.chipTxt}>☕ {entry.drink}</Text>
                    </View>
                  ) : null}
                  <View style={s.chip}>
                    <Text style={s.chipTxt}>⏱ ~{entry.estimated_wait_min || 0} min</Text>
                  </View>
                </View>

                {/* Botón iniciar */}
                <TouchableOpacity
                  style={[s.btn, s.btnIniciar, isPending && s.btnDisabled]}
                  onPress={() => handleIniciar(entry)}
                  disabled={isPending}
                >
                  <Text style={s.btnIniciarTxt}>
                    {isPending ? 'Procesando…' : '▶  Iniciar servicio'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* ── Stats del día ── */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: COLORS.ok }]}>{completados}</Text>
            <Text style={s.statLbl}>COMPLETADOS HOY</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: COLORS.gold }]}>
              ${fmt(ticketProm)}
            </Text>
            <Text style={s.statLbl}>TICKET PROMEDIO</Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Toast ── */}
      {toastMsg ? (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastTxt}>{toastMsg}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 48 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },

  // Toggle
  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, padding: 18, marginBottom: 14,
    minHeight: 72,
  },
  toggleOn:  { backgroundColor: 'rgba(77,184,122,.1)',  borderWidth: 1.5, borderColor: COLORS.ok },
  toggleOff: { backgroundColor: 'rgba(201,168,76,.07)', borderWidth: 1.5, borderColor: COLORS.gold3 },
  toggleDot: { width: 14, height: 14, borderRadius: 7 },
  toggleLabel:{ fontSize: 19, fontWeight: '600', letterSpacing: 0.3 },
  toggleSub: { fontSize: 12, color: COLORS.text3, marginTop: 2 },
  toggleArrow:{ fontSize: 22, fontWeight: '700' },

  // IN SERVICE
  inServiceCard: {
    backgroundColor: COLORS.s2, borderRadius: 16,
    borderWidth: 1.5, borderColor: COLORS.ok,
    borderLeftWidth: 4, borderLeftColor: COLORS.ok,
    padding: 16, marginBottom: 16,
  },
  inServiceLabel: {
    fontSize: 10, color: COLORS.ok, fontWeight: '700',
    letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12,
  },
  inServiceRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  inServiceName: { fontSize: 20, color: COLORS.text, fontWeight: '600' },
  inServiceSvc:  { fontSize: 13, color: COLORS.text2, marginTop: 3 },
  inServiceDrink:{ fontSize: 12, color: COLORS.text3, marginTop: 4 },
  elapsedBlock:  { alignItems: 'center', paddingLeft: 16, minWidth: 72 },
  elapsedNum:    { fontSize: 30, color: COLORS.ok, fontWeight: '200', lineHeight: 34 },
  elapsedLbl:    { fontSize: 9, color: COLORS.text3, letterSpacing: 1.5,
    textTransform: 'uppercase', marginTop: 2 },

  // Section label
  sectionLabel: {
    fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 12,
  },

  // Queue card
  queueCard: {
    backgroundColor: COLORS.s1, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 10,
  },
  queueCardImminent: {
    borderColor: COLORS.gold3, backgroundColor: 'rgba(201,168,76,.05)',
  },
  queueTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  posCircle:   { width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.s3, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  posCircleImminent: { backgroundColor: 'rgba(201,168,76,.15)' },
  posNum:      { fontSize: 14, color: COLORS.text2, fontWeight: '700' },
  clientName:  { fontSize: 17, color: COLORS.text, fontWeight: '600' },
  clientSvc:   { fontSize: 13, color: COLORS.text2, marginTop: 3 },

  statusBadge:    { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  badgeWaiting:   { backgroundColor: 'rgba(92,80,64,.4)' },
  badgeImminent:  { backgroundColor: 'rgba(201,168,76,.14)', borderWidth: 1, borderColor: COLORS.gold3 },
  statusTxt:      { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  statusWaiting:  { color: COLORS.text3 },
  statusImminent: { color: COLORS.gold },

  chips: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  chip:  { backgroundColor: COLORS.s3, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5 },
  chipTxt: { fontSize: 12, color: COLORS.text2 },

  // Buttons
  btn:          { borderRadius: 12, paddingVertical: 13, alignItems: 'center', minHeight: 48 },
  btnIniciar:   { backgroundColor: COLORS.s3, borderWidth: 1, borderColor: COLORS.border2 },
  btnCompletar: { backgroundColor: 'rgba(77,184,122,.12)',
    borderWidth: 1, borderColor: COLORS.ok },
  btnDisabled:  { opacity: 0.4 },
  btnIniciarTxt:  { fontSize: 15, color: COLORS.text, fontWeight: '600', letterSpacing: 0.2 },
  btnCompletarTxt:{ fontSize: 15, color: COLORS.ok,   fontWeight: '600', letterSpacing: 0.2 },

  // Empty state
  empty:    { alignItems: 'center', paddingVertical: 52 },
  emptyIco: { fontSize: 42, marginBottom: 12 },
  emptyTxt: { fontSize: 16, color: COLORS.text3, letterSpacing: 1 },

  // Stats footer
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  statCard: {
    flex: 1, backgroundColor: COLORS.s1, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 16, alignItems: 'center',
  },
  statVal: { fontSize: 30, fontWeight: '300', marginBottom: 4 },
  statLbl: { fontSize: 9, color: COLORS.text3, letterSpacing: 2.5, textTransform: 'uppercase' },

  // Toast
  toast: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    backgroundColor: COLORS.ok, borderRadius: 14,
    padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 10,
  },
  toastTxt: { fontSize: 15, color: '#fff', fontWeight: '600', textAlign: 'center' },
});
