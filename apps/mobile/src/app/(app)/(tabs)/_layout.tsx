import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '../../../components/TabBar';
import { colors } from '../../../theme';

/**
 * Inicio · Tarjetas · Perfil (research.md R8). The center button and Pagos arrive in later specs
 * without changing this structure. Each tab draws its own title, so the header is hidden.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="home" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="cards" options={{ title: 'Tarjetas' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
