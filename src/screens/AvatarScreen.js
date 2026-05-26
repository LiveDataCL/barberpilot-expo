import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { COLORS } from '../constants';

const AVATARES = {
  '🎭 Personajes': ['🤖','👨‍🚀','🧙','🦸','🥷','👑','🎩','💀','👨‍🎤','🧑‍🎨','🕵️','🧑‍🚒'],
  '🦁 Animales':   ['🦁','🐯','🦊','🐺','🐻','🦅','🦋','🐸','🐲','🦈','🦉','🐮','🦓'],
  '⚽ Deportes':   ['⚽','🏀','🎾','🥊','🏋️','🤸','🏄','🎯','🏆','⛹️','🤼','🚴'],
  '🌍 Países':     ['🇨🇱','🇨🇴','🇲🇽','🇧🇷','🇦🇷','🇺🇸','🇪🇸','🇯🇵','🇫🇷','🇮🇹','🇩🇪','🇬🇧'],
  '🎨 Cool':       ['🔥','⚡','💎','🌟','🎸','🎵','🏴‍☠️','🌈','❄️','🌊','💥','🎯'],
};

const KEY_EMOJI = (bid) => `bp_avatar_${bid}`;

export default function AvatarScreen({ barbero, onClose }) {
  const [categoria, setCategoria] = useState('🎭 Personajes');
  const [emoji,     setEmoji]     = useState(barbero.letra);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(KEY_EMOJI(barbero.bid))
      .then(em => { if (em) setEmoji(em); })
      .catch(() => {});
  }, []);

  const guardar = async () => {
    setGuardando(true);
    try {
      await SecureStore.setItemAsync(KEY_EMOJI(barbero.bid), emoji);
      onClose({ type: 'emoji', emoji });
    } catch {
      Alert.alert('Error al guardar el avatar');
    }
    setGuardando(false);
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Tu avatar</Text>
        <TouchableOpacity onPress={() => onClose(null)}>
          <Text style={s.close}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={s.preview}>
        <View style={[s.avatarBig, { backgroundColor: barbero.bg }]}>
          <Text style={s.avatarBigTxt}>{emoji}</Text>
        </View>
        <Text style={s.previewNom}>{barbero.nombre}</Text>
      </View>

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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.grid}>
        {AVATARES[categoria].map((em, i) => (
          <TouchableOpacity key={i}
            style={[s.emojiBtn, emoji === em && s.emojiBtnOn]}
            onPress={() => setEmoji(em)}>
            <Text style={s.emojiTxt}>{em}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={s.btnGuardar} onPress={guardar} disabled={guardando}>
        {guardando
          ? <ActivityIndicator color={COLORS.bg} />
          : <Text style={s.btnGuardarTxt}>✓ Guardar avatar</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },
  header:       { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 18, paddingTop: 24 },
  title:        { fontSize: 20, color: COLORS.text, fontWeight: '600' },
  close:        { fontSize: 22, color: COLORS.text3 },

  preview:      { alignItems: 'center', paddingVertical: 18 },
  avatarBig:    { width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, overflow: 'hidden' },
  avatarBigTxt: { fontSize: 50 },
  previewNom:   { fontSize: 18, color: COLORS.text, fontWeight: '500' },

  cats:         { flexGrow: 0, marginBottom: 12 },
  catBtn:       { paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
    backgroundColor: COLORS.s2, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  catBtnOn:     { borderColor: COLORS.gold, backgroundColor: 'rgba(201,168,76,.1)' },
  catTxt:       { fontSize: 13, color: COLORS.text2 },

  grid:         { flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 14, paddingBottom: 20, gap: 6 },
  emojiBtn:     { width: 60, height: 60, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.s2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  emojiBtnOn:   { borderColor: COLORS.gold, backgroundColor: 'rgba(201,168,76,.15)' },
  emojiTxt:     { fontSize: 32 },

  btnGuardar:   { backgroundColor: COLORS.gold, margin: 18, padding: 16,
    borderRadius: 14, alignItems: 'center' },
  btnGuardarTxt:{ fontSize: 17, color: COLORS.bg, fontWeight: '700' },
});
