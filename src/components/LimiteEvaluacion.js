// The React Native boundary used by ConfigScreen around MiEvaluacion. The logic is in limiteErrorCore.js.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants';
import { crearLimiteError } from './limiteErrorCore';

const estilos = StyleSheet.create({
  caja: { margin: 16, padding: 18, backgroundColor: COLORS.s1, borderColor: COLORS.border, borderWidth: 1, borderRadius: 10 },
  texto: { color: COLORS.text, fontSize: 15 },
});

export default crearLimiteError({ React, View, Text, estilos });
