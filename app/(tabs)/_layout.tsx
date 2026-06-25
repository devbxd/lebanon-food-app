import { Tabs } from 'expo-router'
import { useTranslation } from '../../lib/LanguageContext'

export default function TabLayout() {
  const { t } = useTranslation()

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: '#1a1a1a', borderTopColor: '#2a2a2a' },
      tabBarActiveTintColor: '#FF6B35',
      tabBarInactiveTintColor: '#666',
    }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} /> }} />
      <Tabs.Screen name="orders" options={{ title: t('tabs.orders'), tabBarIcon: ({ color }) => <TabIcon emoji="📦" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }} />
    </Tabs>
  )
}

function TabIcon({ emoji, color }: { emoji: string, color: string }) {
  const { Text } = require('react-native')
  return <Text style={{ fontSize: 20, opacity: color === '#FF6B35' ? 1 : 0.5 }}>{emoji}</Text>
}

