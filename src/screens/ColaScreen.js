import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, fmt, hoy } from '../constants';
import { api } from '../services/api';
import PaymentSheet from '../components/PaymentSheet';

// bid 'b1'...'b4' → lowercase nombre para la API de cola
const queueId = (barbero) => barbero.nombre.toLowerCase();

// ── Timer de tiempo transcurrido ──────────────────────────────
function ElapsedTimer({ serviceStart }) {
  const [mins, setMins] = useState(0);
  useEffect(() => {
    if (!serviceStart) return;
    const tick = () =>
      setMins(Math.floor((Date.now() - new Date(serviceStart).getTime()) / 60000));
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [serviceStart]);
  return <Text style={s.elapsedNum}>{mins} min</Text>;
}

// ── Helper: cuántos minutos faltan para la cita ───────────────
function minsHasta(hora_inicio) {
  if (!hora_inicio) return null;
  const [h, m] = hora_inicio.split(':').map(Number);
  const now = new Date();
  const diff = (h * 60 + m) - (now.getHours() * 60 + now.getMinutes());
  return diff;
}

// ── Normaliza teléfono para comparación ─────────────────────
const normPhone = (p) => (p || '').replace(/[\s\-+()]/g, '');

// ── Abre WhatsApp con mensaje de seguimiento post-servicio ───
async function openPostServiceWhatsApp(phone, name) {
  if (!phone) return;
  let num = normPhone(phone);
  if (num.startsWith('0')) num = num.slice(1);
  if (!num.startsWith('56')) num = '56' + num;
  const msg = encodeURIComponent(
    `Gracias ${name} por visitarnos en Salon Men Saúl Fino ✂️ ` +
    `Si tienes un momento, te agradecemos una reseña en Google. ¡Hasta pronto!`
  );
  try {
    await Linking.openURL(`https://wa.me/${num}?text=${msg}`);
  } catch (_) {}
}

// ── Pantalla principal ─────────────────────────────────────────
export default function ColaScreen({ barbero }) {
  const barberId = queueId(barbero);

  const [queue,        setQueue]        = useState([]);
  const [agenda,       setAgenda]       = useState([]);
  const [hoyData,      setHoyData]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [isAvailable,  setIsAvailable]  = useState(true);
  const [pending,      setPending]      = useState(new Set());
  const [sheetVisible, setSheetVisible] = useState(false);

  // ── Carga unificada ────────────────────────────────────────
  const cargar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [qData, aData, hData] = await Promise.all([
        api.queue(barberId).catch(() => ({ ok: false })),
        api.agenda(barbero.bid, hoy()).catch(() => ({ ok: false })),
        api.hoy(barbero.bid).catch(() => ({ ok: false })),
      ]);
      if (qData?.ok)  setQueue(aData.ok ? qData.queue || [] : qData.queue || []);
      if (aData?.ok)  setAgenda(
        (aData.appointments || []).filter(a => a.estado !== 'cancelado')
      );
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

  // ── Datos derivados ────────────────────────────────────────
  const inService   = queue.find(e => e.status === 'IN_SERVICE');
  const walkIns     = queue
    .filter(e => e.status === 'WAITING' || e.status === 'IMMINENT')
    .sort((a, b) => (a.queue_position || 0) - (b.queue_position || 0));

  // Citas activas (pendiente o confirmado, no completado ni cancelado)
  const citasActivas = agenda.filter(a =>
    a.estado === 'pendiente' || a.estado === 'confirmado'
  ).sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));

  // Stats del footer
  const completados = hoyData?.servicios || 0;
  const facturado   = hoyData?.facturado  || 0;
  const ticketProm  = completados > 0 ? Math.round(facturado / completados) : 0;

  // ── Toggle disponibilidad ──────────────────────────────────
  const handleToggle = async () => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    if (isAvailable) {
      const confirmar = () => setIsAvailable(false);
      if (inService) {
        Alert.alert('¿Seguro?', 'Hay un cliente en servicio activo.',
          [{ text: 'Cancelar', style: 'cancel' },
           { text: 'Confirmar', style: 'destructive', onPress: confirmar }]);
      } else confirmar();
    } else {
      setIsAvailable(true);
    }
  };

  // ── Acciones de cola (walk-ins) ────────────────────────────
  const addPending    = (id) => setPending(p => new Set([...p, id]));
  const removePending = (id) => setPending(p => { const n = new Set(p); n.delete(id); return n; });

  const handleIniciarCola = async (entry) => {
    addPending(entry.id);
    try {
      await api.updateStatus(entry.id, 'IN_SERVICE');
      await cargar(true);
    } catch {
      Alert.alert('Error', 'No se pudo iniciar el servicio.');
    } finally {
      removePending(entry.id);
    }
  };

  // ── Acción: pasar cita a la cola de walk-ins ───────────────
  const handlePasarACola = async (cita) => {
    addPending('apt_' + cita.id);
    try {
      await api.post('/queue/checkin', {
        client_name: cita.client_name,
        phone:       cita.client_phone || null,
        barber_id:   barberId,
        service:     cita.svc_nom,
        drink:       null,
      });
      await cargar(true);
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo agregar a la cola.');
    } finally {
      removePending('apt_' + cita.id);
    }
  };

  // ── Loading inicial ────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  const totalSala = walkIns.length + citasActivas.length;

  // ── Render ─────────────────────────────────────────────────
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
              {isAvailable ? 'Toca para pausar tu cola' : 'Toca para reactivar'}
            </Text>
          </View>
          <Text style={[s.toggleArrow, { color: isAvailable ? COLORS.ok : COLORS.gold3 }]}>
            {isAvailable ? '✓' : '⏸'}
          </Text>
        </TouchableOpacity>

        {/* ── EN SERVICIO AHORA ── */}
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
              style={[s.btn, s.btnCompletar, sheetVisible && s.btnDisabled]}
              onPress={() => setSheetVisible(true)}
              disabled={sheetVisible}
            >
              <Text style={s.btnCompletarTxt}>✅  Completar servicio</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Cabecera sala de espera ── */}
        <View style={s.salaHeader}>
          <Text style={s.sectionLabel}>
            SALA DE ESPERA  ·  {totalSala}{' '}
            {totalSala === 1 ? 'persona' : 'personas'}
          </Text>
          {(walkIns.length > 0 || citasActivas.length > 0) && (
            <View style={s.salaLegend}>
              {walkIns.length > 0 && (
                <View style={s.legendChip}>
                  <View style={[s.legendDot, { backgroundColor: COLORS.gold }]} />
                  <Text style={s.legendTxt}>{walkIns.length} walk-in</Text>
                </View>
              )}
              {citasActivas.length > 0 && (
                <View style={s.legendChip}>
                  <View style={[s.legendDot, { backgroundColor: COLORS.blue }]} />
                  <Text style={s.legendTxt}>{citasActivas.length} agendado</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Estado vacío ── */}
        {totalSala === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyIco}>✂️</Text>
            <Text style={s.emptyTxt}>Sin clientes en espera</Text>
            <Text style={s.emptySub}>
              Los walk-ins aparecen al hacer check-in.{'\n'}
              Las citas agendadas aparecen aquí el día de la reserva.
            </Text>
          </View>
        )}

        {/* ── Walk-ins (desde check-in) ── */}
        {walkIns.map(entry => {
          const isImminent  = entry.status === 'IMMINENT';
          const isPending   = pending.has(entry.id);
          // Cita agendada vinculada a este walk-in por teléfono
          const citaLinked  = entry.phone
            ? citasActivas.find(c => normPhone(c.client_phone) === normPhone(entry.phone))
            : null;
          return (
            <View
              key={'q_' + entry.id}
              style={[s.card, isImminent ? s.cardImminent : s.cardWalkin]}
            >
              {/* Badge de origen */}
              <View style={s.originRow}>
                <View style={[s.originBadge, s.originWalkin]}>
                  <Text style={[s.originTxt, { color: COLORS.gold }]}>🚶 WALK-IN</Text>
                </View>
                <View style={[s.statusBadge, isImminent ? s.badgeImminent : s.badgeWaiting]}>
                  <Text style={[s.statusTxt, isImminent ? s.statusImminent : s.statusWaiting]}>
                    {isImminent ? '🔔 Próximo' : '⏳ En espera'}
                  </Text>
                </View>
              </View>

              {/* Info cliente */}
              <View style={s.cardBody}>
                <View style={[s.posCircle, isImminent && s.posCircleImminent]}>
                  <Text style={[s.posNum, isImminent && { color: COLORS.gold }]}>
                    {entry.queue_position || '—'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.clientName}>{entry.client_name}</Text>
                  <Text style={s.clientSvc}>{entry.service}</Text>
                </View>
              </View>

              {/* Chips */}
              <View style={s.chips}>
                {entry.drink ? (
                  <View style={s.chip}><Text style={s.chipTxt}>☕ {entry.drink}</Text></View>
                ) : null}
                <View style={s.chip}>
                  <Text style={s.chipTxt}>⏱ ~{entry.estimated_wait_min || 0} min espera</Text>
                </View>
                {citaLinked && (
                  <View style={[s.chip, { backgroundColor: 'rgba(85,128,212,.1)' }]}>
                    <Text style={[s.chipTxt, { color: COLORS.blue }]}>
                      📅 Cita {citaLinked.hora_inicio?.slice(0, 5)}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[s.btn, s.btnIniciar, isPending && s.btnDisabled]}
                onPress={() => handleIniciarCola(entry)}
                disabled={isPending}
              >
                <Text style={s.btnIniciarTxt}>
                  {isPending ? 'Procesando…' : '▶  Iniciar servicio'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* ── Citas agendadas (desde saulfino-web) ── */}
        {citasActivas.map(cita => {
          const mins       = minsHasta(cita.hora_inicio);
          const isPending  = pending.has('apt_' + cita.id);
          // Cruzar por teléfono primero; si no hay teléfono, fallback por nombre
          const yaEnCola   = cita.client_phone
            ? queue.some(e => e.status !== 'DONE' && normPhone(e.phone) === normPhone(cita.client_phone))
            : queue.some(e => e.status !== 'DONE' && e.client_name?.toLowerCase() === cita.client_name?.toLowerCase());
          const horaStr    = cita.hora_inicio?.slice(0, 5) || '—';
          const minsLabel  = mins === null ? '' :
            mins <= 0   ? '  ·  ahora' :
            mins < 60   ? `  ·  en ${mins} min` :
            `  ·  ${horaStr}`;

          return (
            <View key={'apt_' + cita.id} style={[s.card, s.cardAgendado]}>
              {/* Badge de origen */}
              <View style={s.originRow}>
                <View style={[s.originBadge, s.originAgendado]}>
                  <Text style={[s.originTxt, { color: COLORS.blue }]}>📅 AGENDADO</Text>
                </View>
                {yaEnCola && (
                  <View style={[s.originBadge, { backgroundColor: 'rgba(77,184,122,.12)', borderColor: COLORS.ok + '44' }]}>
                    <Text style={[s.originTxt, { color: COLORS.ok }]}>✓ En cola</Text>
                  </View>
                )}
              </View>

              {/* Info cliente */}
              <View style={s.cardBody}>
                <View style={s.horaCircle}>
                  <Text style={s.horaNum}>{horaStr}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.clientName}>{cita.client_name}</Text>
                  <Text style={s.clientSvc}>{cita.svc_nom}</Text>
                </View>
              </View>

              {/* Info adicional */}
              <View style={s.chips}>
                {cita.client_phone && (
                  <View style={s.chip}>
                    <Text style={s.chipTxt}>📱 {cita.client_phone}</Text>
                  </View>
                )}
                <View style={[s.chip, { backgroundColor: 'rgba(85,128,212,.1)' }]}>
                  <Text style={[s.chipTxt, { color: COLORS.blue }]}>
                    🕐 {horaStr}{minsLabel}
                  </Text>
                </View>
              </View>

              {/* Botón: pasar a cola si el cliente llega sin hacer check-in */}
              {!yaEnCola && (
                <TouchableOpacity
                  style={[s.btn, s.btnPasarCola, isPending && s.btnDisabled]}
                  onPress={() => handlePasarACola(cita)}
                  disabled={isPending}
                >
                  <Text style={s.btnPasarColaTxt}>
                    {isPending ? 'Agregando…' : '↓  Cliente llegó · Pasar a cola'}
                  </Text>
                </TouchableOpacity>
              )}

              {yaEnCola && (
                <View style={s.enColaInfo}>
                  <Text style={s.enColaTxt}>Este cliente ya está en la cola de espera</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* ── Stats del día ── */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: COLORS.ok }]}>{completados}</Text>
            <Text style={s.statLbl}>COMPLETADOS HOY</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: COLORS.gold }]}>${fmt(ticketProm)}</Text>
            <Text style={s.statLbl}>TICKET PROMEDIO</Text>
          </View>
        </View>
      </ScrollView>

      <PaymentSheet
        visible={sheetVisible}
        entry={inService}
        barbero={barbero}
        onClose={() => setSheetVisible(false)}
        onCompleted={() => {
          setSheetVisible(false);
          const phone = inService?.phone;
          const name  = inService?.client_name;
          if (phone) {
            Alert.alert(
              'Servicio completado',
              `¿Enviar seguimiento por WhatsApp a ${name}?`,
              [
                { text: 'Omitir', style: 'cancel', onPress: () => cargar(true) },
                { text: 'Enviar', onPress: () => { openPostServiceWhatsApp(phone, name); cargar(true); } },
              ]
            );
          } else {
            cargar(true);
          }
        }}
      />
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
    borderRadius: 16, padding: 18, marginBottom: 14, minHeight: 72,
  },
  toggleOn:    { backgroundColor: 'rgba(77,184,122,.1)',  borderWidth: 1.5, borderColor: COLORS.ok },
  toggleOff:   { backgroundColor: 'rgba(201,168,76,.07)', borderWidth: 1.5, borderColor: COLORS.gold3 },
  toggleDot:   { width: 14, height: 14, borderRadius: 7 },
  toggleLabel: { fontSize: 19, fontWeight: '600', letterSpacing: 0.3 },
  toggleSub:   { fontSize: 12, color: COLORS.text3, marginTop: 2 },
  toggleArrow: { fontSize: 22, fontWeight: '700' },

  // EN SERVICIO
  inServiceCard: {
    backgroundColor: COLORS.s2, borderRadius: 16,
    borderWidth: 1.5, borderColor: COLORS.ok,
    borderLeftWidth: 4, borderLeftColor: COLORS.ok,
    padding: 16, marginBottom: 16,
  },
  inServiceLabel:  { fontSize: 10, color: COLORS.ok, fontWeight: '700', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12 },
  inServiceRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  inServiceName:   { fontSize: 20, color: COLORS.text, fontWeight: '600' },
  inServiceSvc:    { fontSize: 13, color: COLORS.text2, marginTop: 3 },
  inServiceDrink:  { fontSize: 12, color: COLORS.text3, marginTop: 4 },
  elapsedBlock:    { alignItems: 'center', paddingLeft: 16, minWidth: 72 },
  elapsedNum:      { fontSize: 30, color: COLORS.ok, fontWeight: '200', lineHeight: 34 },
  elapsedLbl:      { fontSize: 9, color: COLORS.text3, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 },

  // Sala header
  salaHeader: { marginBottom: 12, gap: 6 },
  sectionLabel: { fontSize: 11, color: COLORS.text3, letterSpacing: 2.5, textTransform: 'uppercase' },
  salaLegend:  { flexDirection: 'row', gap: 8 },
  legendChip:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 7, height: 7, borderRadius: 4 },
  legendTxt:   { fontSize: 11, color: COLORS.text3 },

  // Cards generales
  card: {
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10,
  },
  cardWalkin:  { backgroundColor: COLORS.s1, borderColor: COLORS.border },
  cardImminent:{ backgroundColor: 'rgba(201,168,76,.05)', borderColor: COLORS.gold3 },
  cardAgendado:{ backgroundColor: 'rgba(85,128,212,.04)', borderColor: 'rgba(85,128,212,.2)' },

  // Origen badge
  originRow:     { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' },
  originBadge:   { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  originWalkin:  { backgroundColor: 'rgba(201,168,76,.08)', borderColor: 'rgba(201,168,76,.2)' },
  originAgendado:{ backgroundColor: 'rgba(85,128,212,.08)', borderColor: 'rgba(85,128,212,.2)' },
  originTxt:     { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },

  // Card body
  cardBody:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  posCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.s3, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  posCircleImminent: { backgroundColor: 'rgba(201,168,76,.15)' },
  posNum:    { fontSize: 14, color: COLORS.text2, fontWeight: '700' },
  horaCircle:{ width: 50, height: 34, borderRadius: 10, backgroundColor: 'rgba(85,128,212,.12)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  horaNum:   { fontSize: 13, color: COLORS.blue, fontWeight: '700', letterSpacing: 0.3 },

  clientName: { fontSize: 17, color: COLORS.text, fontWeight: '600' },
  clientSvc:  { fontSize: 13, color: COLORS.text2, marginTop: 3 },

  // Status badges
  statusBadge:    { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', marginLeft: 'auto' },
  badgeWaiting:   { backgroundColor: 'rgba(92,80,64,.4)' },
  badgeImminent:  { backgroundColor: 'rgba(201,168,76,.14)', borderWidth: 1, borderColor: COLORS.gold3 },
  statusTxt:      { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  statusWaiting:  { color: COLORS.text3 },
  statusImminent: { color: COLORS.gold },

  // Chips
  chips:   { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  chip:    { backgroundColor: COLORS.s3, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5 },
  chipTxt: { fontSize: 12, color: COLORS.text2 },

  // Botones
  btn:             { borderRadius: 12, paddingVertical: 13, alignItems: 'center', minHeight: 48 },
  btnIniciar:      { backgroundColor: COLORS.s3, borderWidth: 1, borderColor: COLORS.border2 },
  btnCompletar:    { backgroundColor: 'rgba(77,184,122,.12)', borderWidth: 1, borderColor: COLORS.ok },
  btnPasarCola:    { backgroundColor: 'rgba(85,128,212,.1)', borderWidth: 1, borderColor: 'rgba(85,128,212,.3)' },
  btnDisabled:     { opacity: 0.4 },
  btnIniciarTxt:   { fontSize: 15, color: COLORS.text,  fontWeight: '600', letterSpacing: 0.2 },
  btnCompletarTxt: { fontSize: 15, color: COLORS.ok,    fontWeight: '600', letterSpacing: 0.2 },
  btnPasarColaTxt: { fontSize: 15, color: COLORS.blue,  fontWeight: '600', letterSpacing: 0.2 },

  // "Ya en cola" info
  enColaInfo: { backgroundColor: 'rgba(77,184,122,.07)', borderRadius: 10, padding: 10, alignItems: 'center' },
  enColaTxt:  { fontSize: 12, color: COLORS.ok },

  // Empty state
  empty:    { alignItems: 'center', paddingVertical: 40 },
  emptyIco: { fontSize: 40, marginBottom: 10 },
  emptyTxt: { fontSize: 16, color: COLORS.text3, marginBottom: 6 },
  emptySub: { fontSize: 12, color: COLORS.text3, textAlign: 'center', lineHeight: 18 },

  // Stats footer
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  statCard: { flex: 1, backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16, alignItems: 'center' },
  statVal:  { fontSize: 30, fontWeight: '300', marginBottom: 4 },
  statLbl:  { fontSize: 9, color: COLORS.text3, letterSpacing: 2.5, textTransform: 'uppercase' },
});
