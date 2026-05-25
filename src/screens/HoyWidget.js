import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { COLORS, fmt } from '../constants';

export default function HoyWidget({ n = 0, bb = 0, barbero }) {
  const scale   = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY  = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, friction: 7, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideY,  { toValue: 0, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  const hora = new Date().getHours();
  const saludo =
    hora < 12 ? 'Buenos días' :
    hora < 18 ? 'Buenas tardes' : 'Buenas noches';

  const color = barbero?.color || COLORS.gold;

  return (
    <Animated.View style={[s.widget, { transform: [{ scale }, { translateY: slideY }], opacity }]}>
      <Text style={s.saludo}>{saludo}, <Text style={[s.nombre, { color }]}>{barbero?.nombre}</Text> ✂️</Text>
      <View style={s.row}>
        <View style={s.stat}>
          <Text style={[s.big, { color }]}>{n}</Text>
          <Text style={s.lbl}>servicios</Text>
        </View>
        <View style={s.sep} />
        <View style={s.stat}>
          <Text style={[s.big, { color: COLORS.ok }]}>${fmt(bb)}</Text>
          <Text style={s.lbl}>mis ingresos</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  widget: {
    backgroundColor: COLORS.s1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border2,
    padding: 20,
    marginBottom: 14,
  },
  saludo: {
    fontSize: 13,
    color: COLORS.text3,
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  nombre: {
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  sep: {
    width: 1,
    height: 48,
    backgroundColor: COLORS.border2,
  },
  big: {
    fontSize: 38,
    fontWeight: '200',
    lineHeight: 44,
  },
  lbl: {
    fontSize: 10,
    color: COLORS.text3,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 2,
  },
});
