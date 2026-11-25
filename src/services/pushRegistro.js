// Push-token registration. Called from the login effect WITHOUT await, and it never throws: every step is inside the try, so a failure
// (for example a build without google-services, as the preview is) only logs and returns. It cannot block login or the Config screen.
// Dependencies are injected so the node tests can drive each failure: { Notifications, Platform, Device, Constants, fetch, apiUrl, log: { info, error } }.
export async function registrarPushToken(bid, deps) {
  const { Notifications, Platform, Device, Constants, fetch, apiUrl, log } = deps;
  const pasos = ['bid: ' + bid, 'OS: ' + Platform.OS, 'isDevice: ' + Device.isDevice];
  try {
    if (Platform.OS === 'web') {
      log.info('[PUSH]', pasos.join(' | ') + ' → ABORT: web');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'BarberPilot',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#c9a84c',
        sound: 'default',
      });
      pasos.push('canal: ok');
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    pasos.push('perm existente: ' + existing);

    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      pasos.push('nuevo perm: ' + finalStatus);
    }

    if (finalStatus !== 'granted') {
      log.info('[PUSH]', pasos.join(' | ') + ' → ABORT: permiso denegado');
      return;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.manifest2?.extra?.expoClient?.extra?.eas?.projectId ??
      Constants.manifest?.extra?.eas?.projectId;

    pasos.push('projectId: ' + (projectId ? projectId.slice(0, 8) + '...' : 'NONE'));

    if (!projectId) {
      log.info('[PUSH]', pasos.join(' | ') + ' → ABORT: sin projectId');
      return;
    }

    pasos.push('obteniendo token...');
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData?.data;
    pasos.push('token: ' + (token ? token.slice(0, 25) + '...' : 'VACÍO'));

    if (!token) {
      log.info('[PUSH]', pasos.join(' | ') + ' → ABORT: token vacío');
      return;
    }

    pasos.push('enviando al API...');
    const response = await fetch(
      apiUrl + '/push/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid, token }),
      }
    );
    const data = await response.json();
    pasos.push('api: ' + JSON.stringify(data));

    log.info(data.ok ? '[PUSH ✅]' : '[PUSH ❌]', pasos.join(' | '));

  } catch (error) {
    // error can be any value (a native module may reject with undefined): never read a property of it unguarded
    log.error('[PUSH ERROR]', pasos.join(' | '), 'ERROR:', error?.message ?? String(error));
  }
}
