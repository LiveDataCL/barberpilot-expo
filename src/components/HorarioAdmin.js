import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants';
import { fetchAutenticado } from '../services/api';
import { RE_HHMM, cuerpoMarcar, jornadaTexto, notaDe } from '../services/horario';

// Horario (admin). Mirrors the panel's Horarios tab (barberpilot-control, index.html: registrarHora, renderHorarios,
// _horCampoHtml, cargarHorariosDesdeRailway). Same routes, same payloads, same rules: the server decides every rule and
// this screen only shows the state and sends the request.
//   read:  GET  /api/v2/asistencia/hoy
//   write: POST /api/v2/asistencia/marcar  (body built by cuerpoMarcar, the same as the panel)

export default function HorarioAdmin({ registrosHoy }) {
  const [data, setData] = useState(null);           // last GET /api/v2/asistencia/hoy
  const [err, setErr] = useState('');
  const [guardando, setGuardando] = useState(false); // the panel disables every field while a mark is being saved
  const [aviso, setAviso] = useState('');            // the result line (the panel's toast)
  const [avisoError, setAvisoError] = useState(false);
  const [horas, setHoras] = useState({});            // { [bid]: { entrada?, salida? } } typed times; undefined = show the server value
  const [motivos, setMotivos] = useState({});        // { [bid]: { entrada?, salida? } }
  const [motivoErr, setMotivoErr] = useState(null);  // { bid, tipo } when the server asks for a reason
  const [dispositivos, setDispositivos] = useState([]);

  const cargado = !!data && !err;

  const cargar = useCallback(async () => {
    try {
      const r = await fetchAutenticado('/api/v2/asistencia/hoy');
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.detalle || j.error || 'HTTP ' + r.status);
      setData(j); setErr('');
    } catch (e) {
      setErr('No se pudieron leer los horarios del servidor (' + (e.message || 'sin conexión') + ').');
    }
  }, []);

  const cargarDispositivos = useCallback(async () => {
    try {
      const r = await fetchAutenticado('/api/v2/auth/devices');
      const j = await r.json();
      if (r.ok && j.ok) setDispositivos(j.devices || []);
    } catch { /* offline: keep the last list */ }
  }, []);

  // Loaded when the tab opens (the panel loads on tab open too); no timer, as in the panel.
  useEffect(() => { cargar(); cargarDispositivos(); }, [cargar, cargarDispositivos]);

  const valorCampo = (bid, tipo, servidor) => (horas[bid] && horas[bid][tipo] !== undefined ? horas[bid][tipo] : servidor);

  // registrarHora() of the panel: body {bid, tipo}; hora only when given; motivo only together with an hora.
  const registrar = async (bid, tipo, hora) => {
    if (guardando || !cargado) return;
    const body = cuerpoMarcar(bid, tipo, hora, motivos[bid] && motivos[bid][tipo]);
    setGuardando(true); setAviso(''); setMotivoErr(null);
    try {
      const r = await fetchAutenticado('/api/v2/asistencia/marcar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      setGuardando(false);
      if (!j.ok) {
        setAvisoError(true);
        setAviso('⚠ ' + (j.detalle || j.error || 'No se guardó la hora.') + ' No se cambió nada.');
        if (j.error === 'motivo_requerido') setMotivoErr({ bid, tipo });
        return;
      }
      setAvisoError(false);
      setAviso(j.sin_cambio ? 'Sin cambios: ya estaba ' + j.valor : '✅ ' + (tipo === 'entrada' ? 'Entrada' : 'Salida') + ' guardada: ' + j.valor);
      setHoras(prev => ({ ...prev, [bid]: { ...(prev[bid] || {}), [tipo]: undefined } }));
      setMotivos(prev => ({ ...prev, [bid]: { ...(prev[bid] || {}), [tipo]: undefined } }));
      cargar();   // the panel re-reads the day after a saved mark
    } catch {
      setGuardando(false); setAvisoError(true);
      setAviso('⚠ Sin conexión: la hora NO se guardó. Inténtalo de nuevo.');
    }
  };

  const marcarAhora = (bid, tipo) => registrar(bid, tipo, '');

  // guardarHoraDeCampo() of the panel: the typed time must be HH:MM.
  const guardarCampo = (bid, tipo, servidor) => {
    const v = valorCampo(bid, tipo, servidor || '');
    if (!RE_HHMM.test(v)) { setAvisoError(true); setAviso('Escribe la hora (HH:MM) antes de guardar.'); return; }
    registrar(bid, tipo, v);
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

  const barberos = data ? data.barberos : [];
  const umbral = data ? data.motivo_obligatorio_min : null;

  const campo = (b, tipo, servidor, meta) => {
    const etiqueta = tipo === 'entrada' ? 'Entrada' : 'Salida';
    const tiene = !!servidor;
    const valor = valorCampo(b.bid, tipo, servidor || '');
    const nota = notaDe(meta);
    const conMotivoErr = motivoErr && motivoErr.bid === b.bid && motivoErr.tipo === tipo;
    return (
      <View style={{ flex: 1 }}>
        <Text style={s.etiqueta}>{etiqueta}</Text>
        <TextInput
          value={valor}
          onChangeText={(t) => setHoras(prev => ({ ...prev, [b.bid]: { ...(prev[b.bid] || {}), [tipo]: t } }))}
          editable={cargado && !guardando}
          placeholder="HH:MM"
          placeholderTextColor={COLORS.text3}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          style={[s.input, tiene && { borderColor: tipo === 'entrada' ? COLORS.ok : COLORS.blue }]}
        />
        <View style={s.botones}>
          {!tiene && (
            <TouchableOpacity style={[s.btnPequeno, (!cargado || guardando) && s.deshabilitado]} disabled={!cargado || guardando} onPress={() => marcarAhora(b.bid, tipo)}>
              <Text style={s.btnPequenoTxt}>Marcar ahora</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.btnPequeno, { backgroundColor: tiene ? (tipo === 'entrada' ? COLORS.ok : COLORS.blue) : COLORS.text2 }, (!cargado || guardando) && s.deshabilitado]}
            disabled={!cargado || guardando} onPress={() => guardarCampo(b.bid, tipo, servidor)}>
            <Text style={s.btnPequenoTxt}>{tiene ? 'Corregir' : 'Guardar hora'}</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          value={(motivos[b.bid] && motivos[b.bid][tipo]) || ''}
          onChangeText={(t) => setMotivos(prev => ({ ...prev, [b.bid]: { ...(prev[b.bid] || {}), [tipo]: t } }))}
          editable={cargado && !guardando}
          maxLength={200}
          placeholder={'Motivo del ajuste' + (umbral != null ? ' (obligatorio si difiere más de ' + umbral + ' min de ahora)' : '')}
          placeholderTextColor={COLORS.text3}
          style={[s.inputMotivo, conMotivoErr && { borderColor: COLORS.red }]}
        />
        {!!nota && <Text style={s.nota}>{nota}</Text>}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.explica}>
        Registra la entrada y salida de cada barbero. «Marcar ahora» guarda la hora actual; si lo registras después, escribe la hora y pulsa «Guardar hora». Todo se guarda en el servidor al instante, queda anotado quién lo hizo, y no se aceptan horas futuras ni de otros días. Si la hora que escribes se aleja de ahora más de lo permitido, el sistema pide el motivo.
      </Text>

      {!!err && (
        <TouchableOpacity onPress={cargar} style={s.aviso}>
          <Text style={s.avisoTxt}>{err} Toca para reintentar.</Text>
        </TouchableOpacity>
      )}
      {!!aviso && <Text style={[s.resultado, { color: avisoError ? COLORS.red : COLORS.ok }]}>{aviso}</Text>}
      {!data && !err && <ActivityIndicator color={COLORS.gold} style={{ marginTop: 20 }} />}

      {barberos.map((b) => {
        const servicios = (registrosHoy || []).filter(r => r.bid === b.bid).length;
        return (
          <View key={b.bid} style={s.tarjeta}>
            <View style={s.cabecera}>
              <Text style={s.cabeceraNom}>{b.nombre}</Text>
              <Text style={s.cabeceraSvc}>{servicios} servicios hoy</Text>
            </View>
            <View style={s.cuerpo}>
              {campo(b, 'entrada', b.entrada, b.entrada_meta)}
              {campo(b, 'salida', b.salida, b.salida_meta)}
            </View>
            <Text style={s.jornada}>Jornada: <Text style={s.jornadaVal}>{jornadaTexto(b.entrada, b.salida)}</Text></Text>
          </View>
        );
      })}

      {data && (
        <>
          <Text style={[s.secLbl, { marginTop: 18 }]}>RESUMEN DEL DÍA · {data.fecha}</Text>
          <View style={s.tabla}>
            <View style={[s.fila, s.filaCab]}>
              <Text style={[s.celda, s.celdaNom, s.cab]}>Barbero</Text>
              <Text style={[s.celda, s.cab]}>Entrada</Text>
              <Text style={[s.celda, s.cab]}>Salida</Text>
              <Text style={[s.celda, s.cab]}>Horas</Text>
              <Text style={[s.celda, s.cab]}>Serv.</Text>
            </View>
            {barberos.map((b) => (
              <View key={b.bid} style={s.fila}>
                <Text style={[s.celda, s.celdaNom, { fontWeight: '600' }]}>{b.nombre}</Text>
                <Text style={[s.celda, { color: b.entrada ? COLORS.ok : COLORS.text3 }]}>{b.entrada || '—'}</Text>
                <Text style={[s.celda, { color: b.salida ? COLORS.blue : COLORS.text3 }]}>{b.salida || '—'}</Text>
                <Text style={s.celda}>{jornadaTexto(b.entrada, b.salida)}</Text>
                <Text style={s.celda}>{(registrosHoy || []).filter(r => r.bid === b.bid).length}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={[s.secLbl, { marginTop: 18 }]}>HUELLA DEL ADMINISTRADOR · EQUIPOS</Text>
      {dispositivos.length === 0 ? (
        <Text style={{ color: COLORS.text3, fontSize: 13 }}>Ningún equipo con huella.</Text>
      ) : dispositivos.map((d) => (
        <View key={d.id} style={s.tarjeta}>
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
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 18, paddingBottom: 32 },
  secLbl: { fontSize: 11, color: COLORS.text3, letterSpacing: 2.5, marginBottom: 12 },
  explica: { fontSize: 13, color: COLORS.text2, lineHeight: 20, marginBottom: 14 },
  aviso: { backgroundColor: COLORS.s2, borderRadius: 12, padding: 12, marginBottom: 10 },
  avisoTxt: { fontSize: 13, color: COLORS.red },
  resultado: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  tarjeta: { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12, overflow: 'hidden' },
  cabecera: { backgroundColor: COLORS.s3, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cabeceraNom: { fontSize: 15, color: COLORS.text, fontWeight: '700' },
  cabeceraSvc: { fontSize: 11, color: COLORS.text3 },
  cuerpo: { flexDirection: 'row', gap: 12, padding: 14 },
  etiqueta: { fontSize: 10, color: COLORS.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  input: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.s2, color: COLORS.text, paddingHorizontal: 10, fontSize: 15 },
  inputMotivo: { minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.s2, color: COLORS.text, paddingHorizontal: 10, fontSize: 12, marginTop: 6 },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  btnPequeno: { minHeight: 36, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 10, backgroundColor: COLORS.text2 },
  btnPequenoTxt: { fontSize: 12, color: COLORS.bg, fontWeight: '700' },
  deshabilitado: { opacity: 0.4 },
  nota: { fontSize: 11, color: COLORS.text3, marginTop: 4 },
  jornada: { fontSize: 13, color: COLORS.text2, paddingHorizontal: 14, paddingBottom: 12 },
  jornadaVal: { color: COLORS.text, fontWeight: '700' },
  tabla: { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  fila: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'center' },
  filaCab: { borderTopWidth: 0 },
  celda: { flex: 1, fontSize: 12, color: COLORS.text2, textAlign: 'center' },
  celdaNom: { flex: 1.4, textAlign: 'left', color: COLORS.text },
  cab: { fontSize: 10, color: COLORS.text3, textTransform: 'uppercase' },
});
