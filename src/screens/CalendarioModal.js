import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions,
} from 'react-native';
import { COLORS } from '../constants';

const { width } = Dimensions.get('window');

const DIAS_SEM = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

function hoyStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function diasEnMes(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function primerDow(year, month) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // lunes=0 ... domingo=6
}

export default function CalendarioModal({ visible, onClose, onSelect }) {
  const hoy = new Date();
  const [viewYear,  setViewYear]  = useState(hoy.getFullYear());
  const [viewMonth, setViewMonth] = useState(hoy.getMonth());
  const [desde,     setDesde]     = useState(null);
  const [hasta,     setHasta]     = useState(null);
  const [fase,      setFase]      = useState('desde');

  useEffect(() => {
    if (!visible) {
      setDesde(null);
      setHasta(null);
      setFase('desde');
    }
  }, [visible]);

  const totalDias = diasEnMes(viewYear, viewMonth);
  const offset    = primerDow(viewYear, viewMonth);
  const filas     = Math.ceil((offset + totalDias) / 7);

  const fmtDia = (d) =>
    viewYear + '-' +
    String(viewMonth + 1).padStart(2, '0') + '-' +
    String(d).padStart(2, '0');

  const tocarDia = (dia) => {
    const fecha = fmtDia(dia);
    if (fecha > hoyStr()) return;
    if (fase === 'desde') {
      setDesde(fecha);
      setHasta(null);
      setFase('hasta');
    } else {
      if (fecha < desde) {
        setHasta(desde);
        setDesde(fecha);
      } else {
        setHasta(fecha);
      }
      setFase('desde');
    }
  };

  const prevMes = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };

  const nextMes = () => {
    const ahora = hoy.getFullYear() * 100 + hoy.getMonth();
    const vista  = viewYear * 100 + viewMonth;
    if (vista >= ahora) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const aplicar = () => {
    if (!desde) return;
    onSelect({ desde, hasta: hasta || desde });
    onClose();
  };

  const atajo = (ini, fin) => {
    setDesde(ini);
    setHasta(fin);
    setFase('desde');
  };

  const ATAJOS = [
    { label: 'Hoy', fn: () => { const h = hoyStr(); atajo(h, h); }},
    { label: 'Esta semana', fn: () => {
        const d = new Date();
        const dia = d.getDay();
        d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
        atajo(d.toISOString().slice(0, 10), hoyStr());
      }},
    { label: 'Este mes', fn: () => {
        const d = new Date();
        atajo(
          d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01',
          hoyStr()
        );
      }},
    { label: 'Mes anterior', fn: () => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const ld = new Date(y, d.getMonth() + 1, 0).getDate();
        atajo(y + '-' + m + '-01', y + '-' + m + '-' + String(ld).padStart(2, '0'));
      }},
    { label: 'Ultimos 30 dias', fn: () => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        atajo(d.toISOString().slice(0, 10), hoyStr());
      }},
  ];

  const CELDA = Math.floor((width - 40 - 28) / 7);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.box}>

          {/* Header */}
          <View style={s.hdr}>
            <Text style={s.titulo}>
              {fase === 'desde' ? 'Toca la fecha de inicio' : 'Toca la fecha de fin'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
              <Text style={s.cerrar}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Rango seleccionado */}
          <View style={s.rangoRow}>
            <TouchableOpacity
              style={[s.rangoItem, fase === 'desde' && s.rangoOn]}
              onPress={() => setFase('desde')}>
              <Text style={s.rangoLbl}>INICIO</Text>
              <Text style={[s.rangoVal, desde && { color: COLORS.text }]}>
                {desde ? desde.slice(5).replace('-', '/') : '-- --'}
              </Text>
            </TouchableOpacity>
            <Text style={{ color: COLORS.text3, fontSize: 18 }}>→</Text>
            <TouchableOpacity
              style={[s.rangoItem, fase === 'hasta' && s.rangoOn]}
              onPress={() => { if (desde) setFase('hasta'); }}>
              <Text style={s.rangoLbl}>FIN</Text>
              <Text style={[s.rangoVal, hasta && { color: COLORS.text }]}>
                {hasta ? hasta.slice(5).replace('-', '/') : '-- --'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Atajos */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {ATAJOS.map((a, i) => (
              <TouchableOpacity key={i} style={s.atajoBtn} onPress={a.fn}>
                <Text style={s.atajoTxt}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Nav mes */}
          <View style={s.navRow}>
            <TouchableOpacity style={s.navBtn} onPress={prevMes}>
              <Text style={s.navTxt}>‹</Text>
            </TouchableOpacity>
            <Text style={s.mesTxt}>{MESES[viewMonth]} {viewYear}</Text>
            <TouchableOpacity style={s.navBtn} onPress={nextMes}>
              <Text style={s.navTxt}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Cabecera semana */}
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            {DIAS_SEM.map(d => (
              <Text key={d} style={[s.diaLbl, { width: CELDA }]}>{d}</Text>
            ))}
          </View>

          {/* Grid días */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {Array.from({ length: filas * 7 }, (_, i) => {
              const dia    = i - offset + 1;
              const valido = dia >= 1 && dia <= totalDias;
              const f      = valido ? fmtDia(dia) : null;
              const futuro = f && f > hoyStr();
              const esD    = f && f === desde;
              const esH    = f && f === hasta;
              const rango  = f && desde && hasta && f > desde && f < hasta;
              const esHoyD = f && f === hoyStr();

              return (
                <TouchableOpacity
                  key={i}
                  disabled={!valido || futuro}
                  onPress={() => valido && !futuro && tocarDia(dia)}
                  style={[
                    { width: CELDA, height: CELDA, alignItems: 'center',
                      justifyContent: 'center' },
                    rango  && { backgroundColor: 'rgba(201,168,76,.15)', borderRadius: 0 },
                    (esD || esH) && { backgroundColor: COLORS.gold,
                      borderRadius: CELDA / 2 },
                    (!valido || futuro) && { opacity: futuro ? 0.25 : 0 },
                  ]}>
                  <Text style={[
                    { fontSize: 14, color: COLORS.text },
                    esHoyD && { color: COLORS.gold, fontWeight: '700' },
                    (esD || esH) && { color: COLORS.bg, fontWeight: '700' },
                    rango  && { color: COLORS.gold },
                  ]}>
                    {valido ? dia : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Botones */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity
              style={{ flex: 1, padding: 14, backgroundColor: COLORS.s2,
                borderRadius: 12, alignItems: 'center' }}
              onPress={() => { setDesde(null); setHasta(null); setFase('desde'); }}>
              <Text style={{ color: COLORS.text2, fontWeight: '600' }}>Limpiar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 2, padding: 14,
                backgroundColor: desde ? COLORS.gold : COLORS.s2,
                borderRadius: 12, alignItems: 'center' }}
              onPress={aplicar}
              disabled={!desde}>
              <Text style={{ color: desde ? COLORS.bg : COLORS.text3,
                fontWeight: '700', fontSize: 14 }}>
                {desde
                  ? (hasta && hasta !== desde
                      ? desde.slice(5) + ' al ' + hasta.slice(5)
                      : desde.slice(5))
                  : 'Selecciona fechas'}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.82)', justifyContent: 'flex-end' },
  box:     { backgroundColor: COLORS.s1, borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  hdr:     { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16 },
  titulo:  { fontSize: 16, color: COLORS.text, fontWeight: '600' },
  cerrar:  { fontSize: 22, color: COLORS.text3 },
  rangoRow:{ flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.s2, borderRadius: 12, padding: 12, marginBottom: 14 },
  rangoItem: { flex: 1, alignItems: 'center', padding: 8, borderRadius: 8 },
  rangoOn: { borderWidth: 1.5, borderColor: COLORS.gold,
    backgroundColor: 'rgba(201,168,76,.12)' },
  rangoLbl: { fontSize: 9, color: COLORS.text3, letterSpacing: 2,
    textTransform: 'uppercase', marginBottom: 4 },
  rangoVal: { fontSize: 20, color: COLORS.text3, fontWeight: '600' },
  atajoBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.s2,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  atajoTxt: { fontSize: 12, color: COLORS.text2 },
  navRow:  { flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10 },
  navBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.s2, borderRadius: 18 },
  navTxt:  { fontSize: 22, color: COLORS.text, lineHeight: 26 },
  mesTxt:  { fontSize: 16, color: COLORS.text, fontWeight: '600' },
  diaLbl:  { textAlign: 'center', fontSize: 11, color: COLORS.text3,
    fontWeight: '600', letterSpacing: 1 },
});
