import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { LanguageProvider, useTranslation } from '../lib/LanguageContext'

const LANGUAGE_STORAGE_KEY = 'app_language'

function RootLayoutNav() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [hasLanguage, setHasLanguage] = useState<boolean | null>(null)
  const router = useRouter()
  const segments = useSegments()
  const { isLoading: langLoading } = useTranslation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((saved) => {
      setHasLanguage(!!saved)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!ready || hasLanguage === null || langLoading) return

    const current = segments[0] as string
    const inAuth = current === 'login' || current === 'register'
    const inDriver = current === 'driver'
    const inLanguage = current === 'language'
    const inSplash = current === 'splash'

    // Le splash gère lui-même sa redirection, on ne touche pas
    if (inSplash) return

    if (!hasLanguage && !inLanguage) {
      router.replace('/language')
      return
    }

    if (hasLanguage && inLanguage) {
      if (!session) router.replace('/login')
      else router.replace('/(tabs)')
      return
    }

    if (!session && !inAuth && !inDriver && !inLanguage) router.replace('/login')
    if (session && inAuth) router.replace('/(tabs)')
  }, [session, ready, hasLanguage, langLoading, segments])

  return <Stack screenOptions={{ headerShown: false }} />
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <RootLayoutNav />
    </LanguageProvider>
  )
}