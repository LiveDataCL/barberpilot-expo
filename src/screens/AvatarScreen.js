import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { COLORS } from '../constants';

// Avatares disponibles — emojis organizados por categoría
const AVATARES = {
  '🦁 Animales': ['🦁','🐯','🦊','🐺','🐻','🦅','🦋','🦊','🐸','🐲','🦅','🦈','🦉','🐮','🦓'],
  '⚽ Deportes': ['⚽','🏀','🎾','🥊','🏋️','🤸','🏄','🎯','🏆','⛹️','🤼','🚴'],
  '🎭 Personajes': ['🤖','👨‍🚀','🧙','🦸','🥷','👑','🎩','💀','👨‍🎤','🧑‍🎨','🕵️','🧑‍🚒'],
  '🌍 Países': ['🇨🇱','🇨🇴','🇲🇽','🇧🇷','🇦🇷','🇺🇸','🇪🇸','🇯🇵','🇫🇷','🇮🇹','🇩🇪','🇬🇧','🇰🇷','🇨🇺','🇻🇪','🇵🇪'],
  '🎨 Cool': ['🔥','⚡','💎','🌟','🎸','🎵','🏴‍☠️','🌈','❄️','🌊','💥','🎯'],
};

export default function AvatarScreen({ barbero, onClose }) {
  const [selected, setSelected] = useState(barbero.letra);
  const [categoria, setCategoria] = useState('🎭 Personajes');

  useEffect(() => {
    SecureStore.getItemAsync('bp_avatar_' + barbero.bid)
      .then(v => { if (v) setSelected(v); })
      .catch(() => {});
  }, []);

  const guardar = async () => {
    try {
      await SecureStore.setItemAsync('bp_avatar_' + barbero.bid, selected);
      Alert.alert('✓ Avatar guardado', 'Tu nuevo avatar se verá la próxima vez que abras la app');
      onClose(selected);
    } catch {
      Alert.alert('Error al guardar');
    }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Elige tu avatar</Text>
        <TouchableOpacity onPress={() => onClose(null)}>
          <Text style={s.close}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Preview */}
      <View style={s.preview}>
        <View style={[s.avatarBig, { backgroundColor: barbero.bg }]}>
          <Text style={s.avatarBigTxt}>{selected}</Text>
        </View>
        <Text style={s.previewNom}>{barbero.nombre}</Text>
      </View>

      {/* Categorías */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.cats} contentContainerStyle={{ paddingHorizontal: 18 }}>
        {Object.keys(AVATARES).map(cat => (
          <TouchableOpacity key={cat}
            style={[s.catBtn, categoria === cat && s.catBtnOn]}
            onPress={() => setCategoria(cat)}>
            <Text style={[s.catTxt, categoria === cat && { color: COLORS.gold }]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Grid de emojis */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.grid}>
        {AVATARES[categoria].map((emoji, i) => (
          <TouchableOpacity key={i}
            style={[s.emojiBtn, selected === emoji && s.emojiBtnOn]}
            onPress={() => setSelected(emoji)}>
            <Text style={s.emoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Botón guardar */}
      <TouchableOpacity style={s.btnGuardar} onPress={guardar}>
        <Text style={s.btnGuardarTxt}>✓ Usar este avatar</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header:    { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 18, paddingTop: 24 },
  title:     { fontSize: 20, color: COLORS.text, fontWeight: '600' },
  close:     { fontSize: 22, color: COLORS.text3 },

  preview:   { alignItems: 'center', paddingVertical: 20 },
  avatarBig: { width: 90, height: 90, borderRadius: 45,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarBigTxt: { fontSize: 50 },
  previewNom:{ fontSize: 18, color: COLORS.text, fontWeight: '500' },

  cats:      { flexGrow: 0, marginBottom: 14 },
  catBtn:    { paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
    backgroundColor: COLORS.s2, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border },
  catBtnOn:  { borderColor: COLORS.gold, backgroundColor: 'rgba(201,168,76,.1)' },
  catTxt:    { fontSize: 13, color: COLORS.text2 },

  grid:      { flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 14, paddingBottom: 20, gap: 6 },
  emojiBtn:  { width: 60, height: 60, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.s2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  emojiBtnOn:{ borderColor: COLORS.gold, backgroundColor: 'rgba(201,168,76,.15)' },
  emoji:     { fontSize: 32 },

  btnGuardar: { backgroundColor: COLORS.gold, margin: 18, padding: 16,
    borderRadius: 14, alignItems: 'center' },
  btnGuardarTxt: { fontSize: 17, color: COLORS.bg, fontWeight: '700' },
});
