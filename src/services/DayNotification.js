import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID  = 'day-summary';
const NOTIF_ID    = 'day-summary';

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name:         'Resumen del día',
    importance:   Notifications.AndroidImportance.LOW,
    enableLights: false,
    showBadge:    false,
  });
}

export async function updateDayNotification(barbero, n, factura, cobra) {
  try {
    await ensureChannel();
    await Notifications.dismissNotificationAsync(NOTIF_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID,
      content: {
        title: 'BarberPilot · ' + barbero.nombre,
        body:  '✂️ ' + n + ' servicios · 💰 $' + Math.round(cobra).toLocaleString('es-CL'),
        sticky: true,
        autoDismiss: false,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID, ongoing: true } : {}),
      },
      trigger: null,
    });
  } catch (_) {}
}
