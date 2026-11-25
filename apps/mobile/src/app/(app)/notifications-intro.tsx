import { router } from 'expo-router';
import { useState } from 'react';
import { PermissionIntro } from '../../components/PermissionIntro';
import { markNotificationsIntroSeen } from '../../notifications/intro-flag';
import { requestNotificationPermission } from '../../notifications/permission';
import { syncDevice } from '../../notifications/registration';

/**
 * "Activa las notificaciones" (spec 006 US1; research.md R13): shown once per device after
 * sign-in. Either button marks it seen and goes home; the app works the same without permission.
 */
export default function NotificationsIntroScreen() {
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    await markNotificationsIntroSeen();
    // The modal opens over the tabs; close it, or land on home if it is the only screen.
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  };

  const activate = async () => {
    setBusy(true);
    try {
      await requestNotificationPermission();
      // Granted → registers the device; denied → Perfil shows "Desactivadas".
      await syncDevice();
    } catch {
      // A failing prompt leaves "Sin activar" in Perfil, where it can be tried again.
    } finally {
      await finish();
    }
  };

  return (
    <PermissionIntro onActivate={() => void activate()} onSkip={() => void finish()} busy={busy} />
  );
}
