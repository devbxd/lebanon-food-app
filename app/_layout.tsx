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
    // Check session client au démarrage
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })

    // Écoute les changements (login / logout)
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    // Vérifie si une langue a déjà été choisie
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

    // Première ouverture de l'app : pas de langue choisie → forcer l'écran de langue
    if (!hasLanguage && !inLanguage) {
      router.replace('/language')
      return
    }

    if (hasLanguage && inLanguage) {
      // Langue déjà choisie mais on est sur l'écran de langue (ex: retour arrière) -> rediriger normalement
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

