import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants';
import { fetchAutenticado } from '../services/api';

// Horario (admin): arrival and departure of today for each barber. The SAME store as the panel's Horarios tab (horarios):
// a departure removes the barber from today's rotation and from the TV, exactly as it does from the panel.
// The server decides every rule (one mark per day, order, reason, audit); this screen shows the state and sends the request.

const minutos = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};
const durTexto = (min) => (min == null || min < 0 ? '—' : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`);
const estadoDe = (r) => (!r.entrada ? 'Aún no llega' : (!r.salida ? 'En el local' : 'Ya se fue'));
const colorDe = (r) => (!r.entrada ? COLORS.text3 : (!r.salida ? COLORS.ok : COLORS.text2));

export default function HorarioAdmin({ enServicio, onCambio }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [menuBid, setMenuBid] = useState(null);
  const [dlg, setDlg] = useState(null);   // { tipo: 'llegada'|'salida'|'corregir'|'anular', b, campo?, hora?, motivo?, confirmado? }
  const [busy, setBusy] = useState(false);
  const [dlgMsg, setDlgMsg] = useState(null);
  const [dispositivos, setDispositivos] = useState([]);

  const cargar = useCallback(async () => {
    try {
      const r = await fetchAutenticado('/api/v2/asistencia/hoy');
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'HTTP ' + r.status);
      setData(j); setErr(null);
    } catch (e) {
      setErr(e.message || 'Sin conexión');
    }
  }, []);

  const cargarDispositivos = useCallback(async () => {
    try {
      const r = await fetchAutenticado('/api/v2/auth/devices');
      const j = await r.json();
      if (r.ok && j.ok) setDispositivos(j.devices || []);
    } catch { /* offline: keep the last list */ }
  }, []);

  useEffect(() => {
    cargar(); cargarDispositivos();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [cargar, cargarDispositivos]);

  const domingo = !!data && new Date(data.fecha + 'T12:00:00').getDay() === 0;

  // One request for every change: the server answers with the new state, or with the reason in Spanish.
  const enviar = async (cuerpo) => {
    setBusy(true); setDlgMsg(null);
    try {
      const r = await fetchAutenticado('/api/v2/asistencia/marcar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setDlgMsg(j.detalle || j.error || ('No se guardó (código ' + r.status + ').')); return false; }
      setDlg(null); setMenuBid(null);
      cargar();
      if (onCambio) onCambio();
      return true;
    } catch {
      setDlgMsg('Sin conexión: no se guardó nada. Intenta de nuevo.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirmarDlg = () => {
    if (!dlg) return;
    const { tipo, b } = dlg;
    if (tipo === 'llegada') return enviar({ bid: b.bid, tipo: 'entrada' });
    if (tipo === 'salida') {
      if (enServicio && enServicio[b.bid] && !dlg.confirmado) { setDlgMsg('Confirma que quieres registrar la salida con un servicio en curso.'); return; }
      return enviar({ bid: b.bid, tipo: 'salida' });
    }
    if (tipo === 'corregir') {
      const motivo = (dlg.motivo || '').trim();
      if (motivo.length < 5 || motivo.length > 120) { setDlgMsg('El motivo es obligatorio: de 5 a 120 caracteres.'); return; }
      return enviar({ bid: b.bid, tipo: dlg.campo, hora: dlg.hora, motivo });
    }
    if (tipo === 'anular') {
      const motivo = (dlg.motivo || '').trim();
      if (motivo.length < 5 || motivo.length > 120) { setDlgMsg('El motivo es obligatorio: de 5 a 120 caracteres.'); return; }
      return enviar({ bid: b.bid, tipo: dlg.campo, accion: 'anular', motivo });
    }
  };

  const restablecerPin = (b) => {
    Alert.alert('Restablecer PIN', `¿Borrar el PIN de ${b.nombre}? Tendrá que crear uno nuevo en su próximo ingreso y sus sesiones se cierran. Queda registrado con tu nombre.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Restablecer', style: 'destructive', onPress: async () => {
          try {
            const r = await fetchAutenticado('/api/v2/staff/' + encodeURIComponent(b.bid) + '/reset-pin', { method: 'POST' });
            const j = await r.json().catch(() => ({}));
            if (!r.ok || !j.ok) Alert.alert('No se restableció', j.detalle || j.error || ('Código ' + r.status));
            else Alert.alert('PIN restablecido', b.nombre + ' creará un PIN nuevo en su próximo ingreso.');
          } catch { Alert.alert('Sin conexión', 'No se restableció el PIN. Intenta de nuevo.'); }
          setMenuBid(null);
        } },
    ]);
  };

  const revocarDispositivo = (d) => {
    Alert.alert('Revocar huella', '¿Quitar la huella de "' + (d.device_label || 'este equipo') + '"? Ese equipo tendrá que ingresar el PIN.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Revocar', style: 'destructive', onPress: async () => {
          try {
            const r = await fetchAutenticado('/api/v2/auth/devices/' + d.id, { method: 'DELETE' });
            if (!r.ok) Alert.alert('No se pudo revocar', 'Intenta de nuevo.');
          } catch { Alert.alert('Sin conexión', 'No se pudo revocar. Intenta de nuevo.'); }
          cargarDispositivos();
        } },
    ]);
  };

  const rows = data ? data.barberos : [];
  const ahoraMin = data ? minutos(data.ahora) : null;

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.secLbl}>HORARIO DE HOY{data ? ' · ' + data.ahora : ''}</Text>
      {domingo && <Text style={s.aviso}>Domingo: el local está cerrado. No se registran marcas hoy.</Text>}
      {err && (
        <TouchableOpacity onPress={cargar} style={s.card}>
          <Text style={{ color: COLORS.red }}>No se pudo leer el horario ({err}). Toca para reintentar.</Text>
        </TouchableOpacity>
      )}
      {!data && !err && <ActivityIndicator color={COLORS.gold} style={{ marginTop: 20 }} />}

      {rows.map((r) => {
        const b = { bid: r.bid, nombre: r.nombre };
        const hayServicio = !!(enServicio && enServicio[r.bid]);
        const horas = r.entrada ? durTexto(minutos(r.salida || data.ahora) - minutos(r.entrada)) : '—';
        const abierto = menuBid === r.bid;
        return (
          <View key={r.bid} style={[s.card, { marginBottom: 10 }]}>
            <View style={s.filaTop}>
              <Text style={s.nombre}>{r.nombre}</Text>
              <Text style={[s.estado, { color: colorDe(r) }]}>{estadoDe(r)}</Text>
            </View>
            <Text style={s.dato}>Llegada: {r.entrada || '—'}{r.entrada_meta ? '  (' + r.entrada_meta.por + ')' : ''}</Text>
            <Text style={s.dato}>Salida: {r.salida || '—'}{r.salida_meta ? '  (' + r.salida_meta.por + ')' : ''}</Text>
            <Text style={s.dato}>Horas en el local: {horas}</Text>
            {hayServicio && r.entrada && !r.salida && <Text style={s.alerta}>Tiene un servicio en curso.</Text>}
            <View style={s.botones}>
              {!r.entrada && !domingo && (
                <TouchableOpacity style={s.btn} onPress={() => setDlg({ tipo: 'llegada', b })}><Text style={s.btnTxt}>Registrar llegada</Text></TouchableOpacity>
              )}
              {r.entrada && !r.salida && !domingo && (
                <TouchableOpacity style={s.btn} onPress={() => setDlg({ tipo: 'salida', b })}><Text style={s.btnTxt}>Registrar salida del turno</Text></TouchableOpacity>
              )}
              <TouchableOpacity style={s.btnSec} onPress={() => setMenuBid(abierto ? null : r.bid)}><Text style={s.btnSecTxt}>⋯</Text></TouchableOpacity>
            </View>
            {abierto && (
              <View style={s.menu}>
                {(r.entrada || r.salida) && (
                  <TouchableOpacity style={s.menuItem} onPress={() => setDlg({ tipo: 'corregir', b, campo: r.salida ? 'salida' : 'entrada', hora: data.ahora, motivo: '' })}>
                    <Text style={s.menuTxt}>Corregir la hora de la {r.salida ? 'salida' : 'llegada'}</Text>
                  </TouchableOpacity>
                )}
                {(r.entrada || r.salida) && (
                  <TouchableOpacity style={s.menuItem} onPress={() => setDlg({ tipo: 'anular', b, campo: r.salida ? 'salida' : 'entrada', motivo: '' })}>
                    <Text style={s.menuTxt}>Anular la última marca ({r.salida ? 'salida' : 'llegada'})</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.menuItem} onPress={() => restablecerPin(b)}>
                  <Text style={s.menuTxt}>Restablecer PIN</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      <Text style={[s.secLbl, { marginTop: 18 }]}>HUELLA DEL ADMINISTRADOR · EQUIPOS</Text>
      {dispositivos.length === 0 ? (
        <Text style={{ color: COLORS.text3, fontSize: 13 }}>Ningún equipo con huella.</Text>
      ) : dispositivos.map((d) => (
        <View key={d.id} style={[s.card, { marginBottom: 10 }]}>
          <Text style={{ fontSize: 15, color: COLORS.text, fontWeight: '600' }}>{d.device_label || 'Equipo'}</Text>
          <Text style={{ fontSize: 12, color: COLORS.text3, marginTop: 4 }}>
            {d.revoked_at ? 'Revocado' : 'Activo'} · último uso: {d.last_used_at ? new Date(d.last_used_at).toLocaleString('es-CL') : 'nunca'}
          </Text>
          {!d.revoked_at && (
            <TouchableOpacity onPress={() => revocarDispositivo(d)} style={{ marginTop: 10, minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: '#E05A5A', fontWeight: '600' }}>Revocar huella</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <Modal visible={!!dlg} transparent animationType="slide" onRequestClose={() => { if (!busy) setDlg(null); }}>
        <View style={s.velo}>
          <View style={s.hoja}>
            {dlg && dlg.tipo === 'llegada' && (<>
              <Text style={s.hojaTitulo}>Registrar llegada de {dlg.b.nombre}</Text>
              <Text style={s.hojaTxt}>Se marca la hora del servidor. Con llegada, {dlg.b.nombre} vuelve a contar como presente en la rotación de hoy.</Text>
            </>)}
            {dlg && dlg.tipo === 'salida' && (<>
              <Text style={s.hojaTitulo}>Registrar salida del turno de {dlg.b.nombre}</Text>
              <Text style={s.hojaTxt}>Esto quita a {dlg.b.nombre} de la rotación de hoy y del TV: no le llegarán clientes hasta que se anule esta salida.</Text>
              {enServicio && enServicio[dlg.b.bid] && (
                <TouchableOpacity onPress={() => setDlg({ ...dlg, confirmado: !dlg.confirmado })} style={s.check}>
                  <Text style={s.checkTxt}>{dlg.confirmado ? '☑' : '☐'} Tiene un servicio en curso. Confirmo registrar la salida igualmente.</Text>
                </TouchableOpacity>
              )}
            </>)}
            {dlg && dlg.tipo === 'corregir' && (<>
              <Text style={s.hojaTitulo}>Corregir la {dlg.campo === 'salida' ? 'salida' : 'llegada'} de {dlg.b.nombre}</Text>
              <Text style={s.hojaTxt}>Hora (HH:MM, hoy, no futura):</Text>
              <TextInput value={dlg.hora} onChangeText={(t) => setDlg({ ...dlg, hora: t })} placeholder="HH:MM" placeholderTextColor={COLORS.text3} style={s.input} />
              <Text style={s.hojaTxt}>Motivo (obligatorio, de 5 a 120 caracteres):</Text>
              <TextInput value={dlg.motivo} onChangeText={(t) => setDlg({ ...dlg, motivo: t })} maxLength={120} placeholder="Motivo de la corrección" placeholderTextColor={COLORS.text3} style={s.input} />
            </>)}
            {dlg && dlg.tipo === 'anular' && (<>
              <Text style={s.hojaTitulo}>Anular la {dlg.campo === 'salida' ? 'salida' : 'llegada'} de {dlg.b.nombre}</Text>
              <Text style={s.hojaTxt}>{dlg.campo === 'salida' ? 'Vuelve a contar como presente en la rotación de hoy.' : 'La marca vuelve a estar vacía.'} Motivo obligatorio (de 5 a 120 caracteres):</Text>
              <TextInput value={dlg.motivo} onChangeText={(t) => setDlg({ ...dlg, motivo: t })} maxLength={120} placeholder="Motivo" placeholderTextColor={COLORS.text3} style={s.input} />
            </>)}
            {dlgMsg && <Text style={s.errTxt}>{dlgMsg}</Text>}
            <TouchableOpacity disabled={busy} onPress={confirmarDlg} style={[s.btn, { marginTop: 14, opacity: busy ? 0.5 : 1 }]}>
              {busy ? <ActivityIndicator color={COLORS.bg} /> : <Text style={s.btnTxt}>Confirmar</Text>}
            </TouchableOpacity>
            <TouchableOpacity disabled={busy} onPress={() => setDlg(null)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
              <Text style={{ color: COLORS.text3 }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 18, paddingBottom: 32 },
  secLbl: { fontSize: 11, color: COLORS.text3, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12 },
  aviso: { fontSize: 13, color: COLORS.text2, marginBottom: 12 },
  card: { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  filaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  nombre: { fontSize: 17, color: COLORS.text, fontWeight: '600' },
  estado: { fontSize: 13, fontWeight: '700' },
  dato: { fontSize: 13, color: COLORS.text2, marginTop: 2 },
  alerta: { fontSize: 12, color: COLORS.gold, marginTop: 6 },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' },
  btn: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, backgroundColor: COLORS.gold, alignItems: 'center' },
  btnTxt: { fontSize: 14, color: COLORS.bg, fontWeight: '700' },
  btnSec: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  btnSecTxt: { fontSize: 18, color: COLORS.text2 },
  menu: { marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 6 },
  menuItem: { minHeight: 44, justifyContent: 'center' },
  menuTxt: { fontSize: 14, color: COLORS.text },
  velo: { flex: 1, backgroundColor: 'rgba(0,0,0,.6)', justifyContent: 'flex-end' },
  hoja: { backgroundColor: COLORS.s1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  hojaTitulo: { fontSize: 17, color: COLORS.text, fontWeight: '700', marginBottom: 8 },
  hojaTxt: { fontSize: 14, color: COLORS.text2, marginBottom: 8 },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.s2, color: COLORS.text, paddingHorizontal: 12, fontSize: 16, marginBottom: 8 },
  check: { minHeight: 44, justifyContent: 'center', marginTop: 6 },
  checkTxt: { fontSize: 14, color: COLORS.gold },
  errTxt: { fontSize: 14, color: COLORS.red, marginTop: 10 },
});
