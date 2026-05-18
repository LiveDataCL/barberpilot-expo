import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
  Modal, Dimensions,
} from 'react-native';
import { COLORS, fmt, fmtM, hoy, mesPeriodo, BARBEROS } from '../constants';
import { api } from '../services/api';

const API_URL = 'https://barberpilot-api-production.up.railway.app';
const { width } = Dimensions.get('window');

const TABS_ADMIN = [
  { id: 'resumen',    label: 'Resumen',    icon: '📊' },
  { id: 'registrar',  label: 'Registrar',  icon: '➕' },
  { id: 'aprobar',    label: 'Aprobar',    icon: '✅' },
  { id: 'mensajes',   label: 'Mensajes',   icon: '💬' },
  { id: 'barberos',   label: 'Barberos',   icon: '✂️' },
];

export default function AdminScreen({ onLogout }) {
  const [tab, setTab]             = useState('resumen');
  const [resumen, setResumen]     = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [badgeAprob, setBadgeAprob] = useState(0);

  // ── Mensajes ────────────────────────────────────────────────
  const [msgBid, setMsgBid]       = useState(null);
  const [msgTexto, setMsgTexto]   = useState('');
  const [enviando, setEnviando]   = useState(false);
  const [modalMsg, setModalMsg]   = useState(false);
  // Registro de servicio por admin
  const [regBid,     setRegBid]     = useState('b1');
  const [regSid,     setRegSid]     = useState('s01');
  const [regPago,    setRegPago]    = useState('efectivo');
  const [regPropina, setRegPropina] = useState('');
  const [regCustomNom, setRegCustomNom] = useState('');
  const [regCustomPrecio, setRegCustomPrecio] = useState('');
  const [regEnviando, setRegEnviando] = useState(false);
  const [regExito,    setRegExito]    = useState(false);

  // ── Barbero seleccionado para ver su perfil ──────────────────
  const [verBarbero, setVerBarbero] = useState(null);
  const [datosBarbero, setDatosBarbero] = useState(null);

  const cargar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [resRes, pendRes] = await Promise.all([
        fetch(`${API_URL}/admin/resumen`).then(r => r.json()),
        fetch(`${API_URL}/pendientes`).then(r => r.json()),
      ]);
      if (resRes.ok)  setResumen(resRes);
      if (pendRes.ok) {
        setPendientes(pendRes.pendientes || []);
        setBadgeAprob(pendRes.total || 0);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    cargar();
    const interval = setInterval(() => cargar(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const aprobar = async (id) => {
    try {
      await fetch(`${API_URL}/registros/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'confirmado' }),
      });
      cargar(true);
    } catch {}
  };

  const rechazar = async (id) => {
    Alert.alert('Rechazar servicio', '¿Confirmas el rechazo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Rechazar', style: 'destructive', onPress: async () => {
        await fetch(`${API_URL}/registros/${id}/estado`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'rechazado' }),
        });
        cargar(true);
      }},
    ]);
  };

  const aprobarTodos = () => {
    Alert.alert('Aprobar todos', `¿Aprobar los ${pendientes.length} servicios pendientes?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aprobar todos', onPress: async () => {
        await Promise.all(pendientes.map(p =>
          fetch(`${API_URL}/registros/${p.id}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'confirmado' }),
          })
        ));
        cargar(true);
      }},
    ]);
  };

  const enviarMensaje = async () => {
    if (!msgTexto.trim() || !msgBid) return;
    setEnviando(true);
    try {
      const b = BARBEROS.find(x => x.bid === msgBid);
      await fetch(`${API_URL}/mensajes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bid_destino: msgBid,
          bnom_destino: b?.nombre || msgBid,
          contenido: msgTexto.trim(),
          bid_origen: 'admin',
        }),
      });
      setMsgTexto('');
      setModalMsg(false);
      Alert.alert('✓ Enviado', `Mensaje enviado a ${b?.nombre}`);
    } catch { Alert.alert('Error', 'No se pudo enviar'); }
    setEnviando(false);
  };

  const verPerfilBarbero = async (b) => {
    setVerBarbero(b);
    try {
      const [hoyRes, mesRes] = await Promise.all([
        api.hoy(b.bid),
        api.mes(b.bid, mesPeriodo()),
      ]);
      setDatosBarbero({ hoy: hoyRes, mes: mesRes });
    } catch {}
  };

  // ── RENDER TABS ─────────────────────────────────────────────

  const registrarServicioAdmin = async () => {
    const svc = SERVICIOS.find(s => s.id === regSid) || SERVICIOS[0];
    const precio = svc.id === 'custom' ? (parseInt(regCustomPrecio)||0) : svc.precio;
    if (precio <= 0) { Alert.alert('Falta el precio'); return; }
    const b = BARBEROS.find(x => x.bid === regBid);
    const com = regPago === 'debito' ? 0.43 : 0.5;
    const bb  = Math.round(precio * com);
    const ts  = Date.now();
    const now = new Date();
    const hora = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    const reg = {
      id: 'TK'+ts, bid: regBid, bnom: b?.nombre||regBid,
      sid: svc.id,
      snom: svc.id==='custom' ? regCustomNom.trim()||'Servicio especial' : svc.nom,
      precio, pago: regPago, com, bb, neg: precio-bb,
      propina: parseInt(regPropina)||0,
      fecha: hoy(), hora, ts,
    };
    setRegEnviando(true);
    try {
      // Admin registra directo como confirmado
      const res = await fetch(`${API_URL}/registros`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(reg),
      }).then(r => r.json());
      if (res.ok) {
        setRegExito(true);
        setRegPropina(''); setRegCustomNom(''); setRegCustomPrecio('');
        await sendPushToBarber(regBid, '✂️ Nuevo servicio', svc.id==='custom' ? regCustomNom : svc.nom);
        setTimeout(() => setRegExito(false), 2500);
        cargar(true);
      }
    } catch { Alert.alert('Error al registrar'); }
    setRegEnviando(false);
  };

  const sendPushToBarber = async (bid, title, body) => {
    try {
      await fetch(`${API_URL}/push/test`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({bid}),
      });
    } catch {}
  };

  const renderRegistrar = () => {
    const svc = SERVICIOS.find(s => s.id === regSid)||SERVICIOS[0];
    const precio = svc.id==='custom' ? (parseInt(regCustomPrecio)||0) : svc.precio;
    const com = regPago==='debito' ? 0.43 : 0.5;
    const bb = Math.round(precio*com)+(parseInt(regPropina)||0);
    const PAGOS = [
      {id:'efectivo', label:'💵 Efectivo', color:COLORS.ok},
      {id:'debito',   label:'💳 Débito',   color:COLORS.blue},
      {id:'transferencia', label:'📲 Transf.', color:COLORS.gold},
    ];
    if (regExito) return (
      <View style={s.center}>
        <Text style={{fontSize:48,marginBottom:12}}>✅</Text>
        <Text style={{fontSize:20,color:COLORS.ok,fontWeight:'600'}}>¡Registrado!</Text>
        <Text style={{fontSize:14,color:COLORS.text3,marginTop:6}}>Asignado a {BARBEROS.find(b=>b.bid===regBid)?.nombre}</Text>
      </View>
    );
    return (
      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.secLbl}>ASIGNAR A BARBERO</Text>
        <View style={{flexDirection:'row',gap:8,marginBottom:18}}>
          {BARBEROS.map(b => (
            <TouchableOpacity key={b.bid}
              style={[s.accionCard, regBid===b.bid && {borderColor:b.color,backgroundColor:'rgba(201,168,76,.08)'}]}
              onPress={() => setRegBid(b.bid)}>
              <View style={[s.accionAvatar,{backgroundColor:b.bg}]}>
                <Text style={[s.accionLetra,{color:b.color}]}>{b.letra}</Text>
              </View>
              <Text style={[s.accionNom,regBid===b.bid&&{color:b.color}]}>{b.nombre}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.secLbl}>SERVICIO</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginHorizontal:-18,paddingLeft:18,marginBottom:16}}>
          {SERVICIOS.filter(s=>s.id!=='custom').map(sv => (
            <TouchableOpacity key={sv.id}
              style={{width:105,backgroundColor:regSid===sv.id?'rgba(201,168,76,.12)':COLORS.s2,
                borderRadius:12,borderWidth:1,borderColor:regSid===sv.id?COLORS.gold:COLORS.border,
                padding:12,marginRight:8,alignItems:'center'}}
              onPress={() => setRegSid(sv.id)}>
              <Text style={{fontSize:13,color:regSid===sv.id?COLORS.gold:COLORS.text2,textAlign:'center',fontWeight:'500',marginBottom:4}}>{sv.nom}</Text>
              <Text style={{fontSize:15,color:regSid===sv.id?COLORS.gold2:COLORS.text3,fontWeight:'600'}}>${sv.precio/1000}K</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={{width:105,backgroundColor:regSid==='custom'?'rgba(201,168,76,.12)':COLORS.s2,
              borderRadius:12,borderWidth:1,borderColor:regSid==='custom'?COLORS.gold:COLORS.border,
              padding:12,marginRight:18,alignItems:'center'}}
            onPress={() => setRegSid('custom')}>
            <Text style={{fontSize:13,color:regSid==='custom'?COLORS.gold:COLORS.text2,textAlign:'center',fontWeight:'500',marginBottom:4}}>Especial…</Text>
            <Text style={{fontSize:15,color:COLORS.text3}}>Libre</Text>
          </TouchableOpacity>
        </ScrollView>

        {regSid==='custom' && (
          <View style={{marginBottom:14}}>
            <TextInput style={s.input} value={regCustomNom} onChangeText={setRegCustomNom}
              placeholder="Nombre del servicio" placeholderTextColor={COLORS.text3}/>
            <TextInput style={[s.input,{marginTop:8}]} value={regCustomPrecio} onChangeText={setRegCustomPrecio}
              placeholder="Precio" placeholderTextColor={COLORS.text3} keyboardType="numeric"/>
          </View>
        )}

        <Text style={s.secLbl}>FORMA DE PAGO</Text>
        <View style={{flexDirection:'row',gap:8,marginBottom:16}}>
          {PAGOS.map(p => (
            <TouchableOpacity key={p.id}
              style={{flex:1,padding:12,borderRadius:12,borderWidth:1.5,alignItems:'center',
                borderColor:regPago===p.id?p.color:COLORS.border2,
                backgroundColor:regPago===p.id?`rgba(77,184,122,.08)`:COLORS.s2}}
              onPress={() => setRegPago(p.id)}>
              <Text style={{fontSize:12,color:regPago===p.id?p.color:COLORS.text2,fontWeight:'600'}}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.secLbl}>PROPINA (OPCIONAL)</Text>
        <TextInput style={[s.input,{marginBottom:16}]} value={regPropina} onChangeText={setRegPropina}
          placeholder="$0" placeholderTextColor={COLORS.text3} keyboardType="numeric"/>

        <View style={{backgroundColor:'rgba(77,184,122,.08)',borderRadius:14,
          borderWidth:1,borderColor:'rgba(77,184,122,.2)',padding:20,alignItems:'center',marginBottom:18}}>
          <Text style={{fontSize:11,color:COLORS.text3,letterSpacing:2,textTransform:'uppercase',marginBottom:6}}>
            RECIBE {BARBEROS.find(b=>b.bid===regBid)?.nombre?.toUpperCase()}
          </Text>
          <Text style={{fontSize:40,color:COLORS.ok,fontWeight:'500'}}>${fmt(bb)}</Text>
          <Text style={{fontSize:13,color:COLORS.text3,marginTop:4}}>{Math.round(com*100)}% · ${fmt(precio)} servicio</Text>
        </View>

        <TouchableOpacity
          style={{backgroundColor:COLORS.gold,borderRadius:14,padding:18,alignItems:'center'}}
          onPress={registrarServicioAdmin} disabled={regEnviando}>
          {regEnviando
            ? <ActivityIndicator color={COLORS.bg}/>
            : <Text style={{fontSize:17,color:COLORS.bg,fontWeight:'700'}}>✓ Registrar servicio</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderResumen = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); cargar(true); }}
        tintColor={COLORS.gold} colors={[COLORS.gold]} />}
    >
      <View style={s.content}>
        {/* Header admin */}
        <View style={s.adminBadge}>
          <Text style={s.adminBadgeTxt}>⚡ PANEL ADMINISTRADOR</Text>
        </View>

        {/* KPIs del día */}
        <Text style={s.secLbl}>HOY · {hoy()}</Text>
        <View style={s.grid2}>
          <View style={[s.statCard, s.statGold]}>
            <Text style={[s.statVal, { color: COLORS.gold }]}>
              {resumen?.hoy?.servicios || 0}
            </Text>
            <Text style={s.statLbl}>Servicios</Text>
          </View>
          <View style={[s.statCard, s.statGreen]}>
            <Text style={[s.statVal, { color: COLORS.ok }]}>
              ${fmt(resumen?.hoy?.facturado || 0)}
            </Text>
            <Text style={s.statLbl}>Facturado</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: COLORS.red }]}>
              {badgeAprob}
            </Text>
            <Text style={s.statLbl}>Pendientes</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statVal}>${fmt(resumen?.hoy?.total_barberos || 0)}</Text>
            <Text style={s.statLbl}>A barberos</Text>
          </View>
        </View>

        {/* Accesos rápidos */}
        <Text style={[s.secLbl, { marginTop: 20 }]}>ACCIONES RÁPIDAS</Text>
        <View style={s.accionGrid}>
          {BARBEROS.map(b => (
            <TouchableOpacity key={b.bid} style={s.accionCard}
              onPress={() => { setMsgBid(b.bid); setModalMsg(true); }}>
              <View style={[s.accionAvatar, { backgroundColor: b.bg }]}>
                <Text style={[s.accionLetra, { color: b.color }]}>{b.letra}</Text>
              </View>
              <Text style={s.accionNom}>{b.nombre}</Text>
              <Text style={s.accionSub}>Enviar nota</Text>
              <Text style={{ fontSize: 18, marginTop: 4 }}>📋</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Pendientes urgentes */}
        {badgeAprob > 0 && (
          <TouchableOpacity style={s.urgente} onPress={() => setTab('aprobar')}>
            <Text style={s.urgenteTxt}>
              ⚠️ {badgeAprob} servicio{badgeAprob !== 1 ? 's' : ''} esperando aprobación
            </Text>
            <Text style={s.urgenteLink}>Ver ahora →</Text>
          </TouchableOpacity>
        )}

        {/* Resumen por barbero hoy */}
        <Text style={[s.secLbl, { marginTop: 24 }]}>PRODUCCIÓN HOY POR BARBERO</Text>
        {BARBEROS.map(b => {
          const regsB = (resumen?.registros_hoy || []).filter(r => r.bid === b.bid);
          const svcB  = resumen?.barberos_hoy?.[b.bid]?.svc || 0;
          const bbB   = resumen?.barberos_hoy?.[b.bid]?.bb  || 0;
          return (
            <View key={b.bid} style={[s.barberoPerfil, { marginBottom: 8 }]}>
              <View style={[s.accionAvatar, { backgroundColor: b.bg, width: 44, height: 44, borderRadius: 22 }]}>
                <Text style={[s.accionLetra, { color: b.color, fontSize: 18 }]}>{b.letra}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.barberoPNom}>{b.nombre}</Text>
                <Text style={s.barberoPSub}>{svcB} servicios · ${fmt(bbB)} ingresos</Text>
              </View>
              <TouchableOpacity
                style={{ backgroundColor: 'rgba(201,168,76,.12)', borderRadius: 8,
                  paddingHorizontal: 12, paddingVertical: 8 }}
                onPress={() => { setMsgBid(b.bid); setModalMsg(true); }}>
                <Text style={{ fontSize: 16 }}>📋</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Accesos rápidos a tabs */}
        <Text style={[s.secLbl, { marginTop: 20 }]}>ACCESO RÁPIDO</Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {[
            { id: 'registrar', label: 'Registrar
servicio', icon: '➕', color: COLORS.gold },
            { id: 'aprobar',   label: 'Bandeja
aprobación', icon: '✅', color: COLORS.ok },
            { id: 'mensajes',  label: 'Enviar
nota', icon: '💬', color: COLORS.blue },
            { id: 'barberos',  label: 'Ver
barberos', icon: '✂️', color: COLORS.text2 },
          ].map(item => (
            <TouchableOpacity key={item.id}
              style={{ flex: 1, minWidth: '45%', backgroundColor: COLORS.s2,
                borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
                padding: 16, alignItems: 'center', gap: 6 }}
              onPress={() => setTab(item.id)}>
              <Text style={{ fontSize: 28 }}>{item.icon}</Text>
              <Text style={{ fontSize: 12, color: item.color, fontWeight: '600',
                textAlign: 'center', letterSpacing: 0.5 }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </View>
    </ScrollView>
  );

  const renderAprobar = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); cargar(true); }}
        tintColor={COLORS.gold} colors={[COLORS.gold]} />}
    >
      <View style={s.content}>
        {pendientes.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>✅</Text>
            <Text style={s.emptyTxt}>Todo al día — sin pendientes</Text>
          </View>
        ) : (
          <>
            <View style={s.rowBetween}>
              <Text style={s.secLbl}>{pendientes.length} PENDIENTE{pendientes.length !== 1 ? 'S' : ''}</Text>
              <TouchableOpacity style={s.btnAprobarTodos} onPress={aprobarTodos}>
                <Text style={s.btnAprobarTodosTxt}>✓ Aprobar todos</Text>
              </TouchableOpacity>
            </View>
            {pendientes.map(r => {
              const bb = parseInt(r.bb || 0) + parseInt(r.propina || 0);
              const pagoColor = r.pago === 'efectivo' ? COLORS.ok
                : r.pago === 'debito' ? COLORS.blue : COLORS.gold;
              return (
                <View key={r.id} style={s.pendCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pendNom}>{r.snom}</Text>
                    <Text style={s.pendSub}>
                      {r.bnom} · {r.hora?.slice(0,5)} ·{' '}
                      <Text style={{ color: pagoColor }}>{r.pago}</Text>
                    </Text>
                    <Text style={s.pendPrecio}>${fmt(r.precio)}</Text>
                  </View>
                  <View style={s.pendMonto}>
                    <Text style={s.pendBB}>${fmt(bb)}</Text>
                    <Text style={s.pendBBLbl}>barbero</Text>
                  </View>
                  <View style={s.pendBtns}>
                    <TouchableOpacity style={s.btnOk} onPress={() => aprobar(r.id)}>
                      <Text style={s.btnOkTxt}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.btnNo} onPress={() => rechazar(r.id)}>
                      <Text style={s.btnNoTxt}>✗</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </View>
    </ScrollView>
  );

  const renderMensajes = () => (
    <ScrollView>
      <View style={s.content}>
        <Text style={s.secLbl}>ENVIAR NOTA A BARBERO</Text>
        <Text style={{ fontSize: 13, color: COLORS.text3, marginBottom: 16 }}>
          El mensaje llega como notificación push y queda en el historial de la app.
        </Text>
        {BARBEROS.map(b => (
          <TouchableOpacity key={b.bid} style={s.msgBarberoBtn}
            onPress={() => { setMsgBid(b.bid); setModalMsg(true); }}>
            <View style={[s.accionAvatar, { backgroundColor: b.bg, width: 44, height: 44, borderRadius: 22 }]}>
              <Text style={[s.accionLetra, { color: b.color, fontSize: 18 }]}>{b.letra}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.msgBarberoNom}>{b.nombre}</Text>
              <Text style={s.msgBarberoPush}>Toca para enviar una nota</Text>
            </View>
            <Text style={{ fontSize: 22, color: COLORS.gold }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderBarberos = () => (
    <ScrollView>
      <View style={s.content}>
        <Text style={s.secLbl}>PERFIL DE BARBEROS</Text>
        {BARBEROS.map(b => (
          <TouchableOpacity key={b.bid} style={s.barberoPerfil}
            onPress={() => verPerfilBarbero(b)}>
            <View style={[s.accionAvatar, { backgroundColor: b.bg, width: 52, height: 52, borderRadius: 26 }]}>
              <Text style={[s.accionLetra, { color: b.color, fontSize: 22 }]}>{b.letra}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={s.barberoPNom}>{b.nombre}</Text>
              <Text style={s.barberoPSub}>Ver producción · Enviar nota</Text>
            </View>
            <Text style={{ fontSize: 22, color: COLORS.text3 }}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Detalle del barbero seleccionado */}
        {verBarbero && datosBarbero && (
          <View style={[s.card, { marginTop: 20 }]}>
            <View style={s.rowBetween}>
              <Text style={s.cardTitle}>
                {verBarbero.nombre.toUpperCase()} · HOY
              </Text>
              <TouchableOpacity onPress={() => { setVerBarbero(null); setDatosBarbero(null); }}>
                <Text style={{ color: COLORS.text3, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={s.grid2}>
              <View style={s.statCard}>
                <Text style={s.statVal}>{datosBarbero.hoy?.servicios || 0}</Text>
                <Text style={s.statLbl}>Svc hoy</Text>
              </View>
              <View style={[s.statCard, s.statGreen]}>
                <Text style={[s.statVal, { color: COLORS.ok }]}>
                  ${fmt(datosBarbero.hoy?.a_cobrar || 0)}
                </Text>
                <Text style={s.statLbl}>A cobrar</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statVal}>{datosBarbero.mes?.servicios || 0}</Text>
                <Text style={s.statLbl}>Svc mes</Text>
              </View>
              <View style={[s.statCard, s.statGold]}>
                <Text style={[s.statVal, { color: COLORS.gold }]}>
                  {fmtM(datosBarbero.mes?.a_cobrar || 0)}
                </Text>
                <Text style={s.statLbl}>Mes</Text>
              </View>
            </View>
            <TouchableOpacity style={[s.btnAprobarTodos, { marginTop: 14 }]}
              onPress={() => { setMsgBid(verBarbero.bid); setModalMsg(true); }}>
              <Text style={s.btnAprobarTodosTxt}>📋 Enviar nota a {verBarbero.nombre}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );

  // ── MODAL MENSAJE ────────────────────────────────────────────
  const b = BARBEROS.find(x => x.bid === msgBid);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Nav tabs admin */}
      <View style={s.adminTabs}>
        {TABS_ADMIN.map(t => (
          <TouchableOpacity key={t.id} style={[s.adminTab, tab === t.id && s.adminTabOn]}
            onPress={() => setTab(t.id)}>
            <Text style={s.adminTabIcon}>{t.icon}</Text>
            {t.id === 'aprobar' && badgeAprob > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeTxt}>{badgeAprob}</Text>
              </View>
            )}
            <Text style={[s.adminTabLbl, tab === t.id && { color: COLORS.gold }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenido */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.gold} /></View>
      ) : (
        tab === 'resumen'   ? renderResumen()   :
        tab === 'registrar' ? renderRegistrar() :
        tab === 'aprobar'   ? renderAprobar()   :
        tab === 'mensajes'  ? renderMensajes()  :
        renderBarberos()
      )}

      {/* Modal enviar mensaje */}
      <Modal visible={modalMsg} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>
              Nota para {b?.nombre}
            </Text>
            <TextInput
              style={s.msgInput}
              value={msgTexto}
              onChangeText={setMsgTexto}
              placeholder="Escribe la nota aquí..."
              placeholderTextColor={COLORS.text3}
              multiline
              numberOfLines={4}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: COLORS.s2, flex: 1 }]}
                onPress={() => { setModalMsg(false); setMsgTexto(''); }}>
                <Text style={{ color: COLORS.text2, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: COLORS.gold, flex: 2 }]}
                onPress={enviarMensaje} disabled={enviando}>
                {enviando
                  ? <ActivityIndicator color={COLORS.bg} />
                  : <Text style={{ color: COLORS.bg, fontWeight: '700', fontSize: 15 }}>
                      📤 Enviar
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  content:  { padding: 18, paddingBottom: 32 },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:    { alignItems: 'center', paddingVertical: 60 },
  emptyTxt: { fontSize: 16, color: COLORS.text3 },

  adminBadge: { backgroundColor: 'rgba(201,168,76,.12)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(201,168,76,.3)',
    padding: 10, alignItems: 'center', marginBottom: 20 },
  adminBadgeTxt: { fontSize: 13, color: COLORS.gold, fontWeight: '700', letterSpacing: 2 },

  secLbl:   { fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 12 },

  grid2:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: COLORS.s2,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  statGreen:{ backgroundColor: 'rgba(77,184,122,.07)', borderColor: 'rgba(77,184,122,.2)' },
  statGold: { backgroundColor: 'rgba(201,168,76,.07)', borderColor: 'rgba(201,168,76,.2)' },
  statVal:  { fontSize: 26, color: COLORS.text, fontWeight: '600' },
  statLbl:  { fontSize: 11, color: COLORS.text3, marginTop: 4,
    textTransform: 'uppercase', letterSpacing: 1 },

  accionGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  accionCard: { flex: 1, backgroundColor: COLORS.s2, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, alignItems: 'center' },
  accionAvatar: { width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  accionLetra: { fontSize: 20, fontWeight: '700' },
  accionNom:  { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  accionSub:  { fontSize: 11, color: COLORS.text3, marginTop: 2 },

  urgente:  { backgroundColor: 'rgba(224,85,85,.1)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(224,85,85,.3)',
    padding: 16, marginTop: 8, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center' },
  urgenteTxt: { fontSize: 14, color: '#e05555', flex: 1 },
  urgenteLink:{ fontSize: 14, color: COLORS.gold, fontWeight: '700' },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14 },
  btnAprobarTodos: { backgroundColor: 'rgba(77,184,122,.15)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(77,184,122,.3)',
    paddingHorizontal: 14, paddingVertical: 9 },
  btnAprobarTodosTxt: { fontSize: 13, color: COLORS.ok, fontWeight: '700' },

  pendCard: { flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 14, marginBottom: 10, gap: 10 },
  pendNom:  { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  pendSub:  { fontSize: 12, color: COLORS.text3, marginTop: 2 },
  pendPrecio: { fontSize: 13, color: COLORS.text2, marginTop: 4 },
  pendMonto:{ alignItems: 'center', minWidth: 60 },
  pendBB:   { fontSize: 16, color: COLORS.ok, fontWeight: '600' },
  pendBBLbl:{ fontSize: 10, color: COLORS.text3, textTransform: 'uppercase' },
  pendBtns: { gap: 6 },
  btnOk:    { backgroundColor: 'rgba(77,184,122,.15)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(77,184,122,.3)',
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  btnOkTxt: { fontSize: 18, color: COLORS.ok, fontWeight: '700' },
  btnNo:    { backgroundColor: 'rgba(224,85,85,.1)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(224,85,85,.25)',
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  btnNoTxt: { fontSize: 18, color: COLORS.red, fontWeight: '700' },

  msgBarberoBtn: { flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 16, marginBottom: 10 },
  msgBarberoNom: { fontSize: 18, color: COLORS.text, fontWeight: '600' },
  msgBarberoPush:{ fontSize: 12, color: COLORS.text3, marginTop: 2 },

  barberoPerfil: { flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 16, marginBottom: 10 },
  barberoPNom: { fontSize: 20, color: COLORS.text, fontWeight: '600' },
  barberoPSub: { fontSize: 12, color: COLORS.text3, marginTop: 2 },

  card:     { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 18 },
  cardTitle:{ fontSize: 11, color: COLORS.text3, letterSpacing: 2,
    textTransform: 'uppercase', marginBottom: 14 },

  adminTabs: { flexDirection: 'row', backgroundColor: COLORS.s1,
    borderBottomWidth: 1, borderBottomColor: COLORS.border },
  adminTab:  { flex: 1, alignItems: 'center', paddingVertical: 10,
    position: 'relative' },
  adminTabOn:{ borderBottomWidth: 2, borderBottomColor: COLORS.gold },
  adminTabIcon: { fontSize: 20 },
  adminTabLbl:  { fontSize: 10, color: COLORS.text3, marginTop: 3,
    textTransform: 'uppercase', letterSpacing: 0.5 },
  badge:    { position: 'absolute', top: 6, right: '20%',
    backgroundColor: COLORS.red, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4 },
  badgeTxt: { fontSize: 10, color: '#fff', fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.7)',
    justifyContent: 'flex-end' },
  modalBox:  { backgroundColor: COLORS.s1, borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle:{ fontSize: 18, color: COLORS.text, fontWeight: '600',
    marginBottom: 16, letterSpacing: 0.5 },
  msgInput:  { backgroundColor: COLORS.s2, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border2, color: COLORS.text,
    fontSize: 16, padding: 14, minHeight: 100, textAlignVertical: 'top' },
  modalBtn:  { padding: 14, borderRadius: 12, alignItems: 'center' },
  input:     { backgroundColor: COLORS.s2, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.border2, color: COLORS.text, fontSize: 16, padding: 14 },
  scroll:    { flex: 1, backgroundColor: COLORS.bg },
});
