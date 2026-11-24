import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '../../../components/TabBar';
import { colors } from '../../../theme';

/**
 * Inicio · Tarjetas · Registrar compra · Pagos · Perfil (spec 002 research.md R8, spec 004 R8,
 * spec 005 R10). `register` is never shown: the TabBar draws it as the center button, which opens
 * `purchase/new`. Each tab draws its own title, so the header is hidden.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="home" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="cards" options={{ title: 'Tarjetas' }} />
      <Tabs.Screen name="register" options={{ title: 'Registrar compra' }} />
      <Tabs.Screen name="payments" options={{ title: 'Pagos' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
