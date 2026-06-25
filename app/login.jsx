import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native'
import { useTranslation } from '../lib/LanguageContext'
import { LANGUAGES } from '../lib/i18n'
import { supabase } from '../lib/supabase'

export default function LoginScreen() {
  const { t, lang, setLang } = useTranslation()
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [langModal, setLangModal] = useState(false)

  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]

  function formatPhone(raw) {
    const digits = raw.replace(/\D/g, '')
    if (digits.startsWith('00961')) return '+' + digits.slice(2)
    if (digits.startsWith('961'))   return '+' + digits
    if (digits.startsWith('0'))     return '+961' + digits.slice(1)
    if (digits.length === 0)        return '+96170000000'
    return '+961' + digits
  }

  // ── Connexion directe sans vérification OTP ───────────────────────────────
  async function loginDirect() {
    setLoading(true)
    const formatted = formatPhone(phone)

    // On stocke le numéro dans AsyncStorage pour simuler une session
    await AsyncStorage.setItem('temp_phone', formatted)
    await AsyncStorage.setItem('temp_role', 'client')

    // Vérifier si c'est un livreur connu dans la table profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, id')
      .eq('phone', formatted)
      .single()

    setLoading(false)

    if (profile?.role === 'driver') {
      router.replace({
        pathname: '/driver',
        params: { driverId: profile.id, driverName: profile.full_name || 'Livreur' }
      })
    } else {
      router.replace('/(tabs)')
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={s.langBtn} onPress={() => setLangModal(true)}>
          <Text style={s.langBtnFlag}>{currentLang.flag}</Text>
          <Text style={s.langBtnTxt}>{currentLang.label}</Text>
        </TouchableOpacity>

        <View style={s.logoBox}>
          <Text style={s.logoEmoji}>🍽️</Text>
          <Text style={s.logoName}>HUNGRYYY</Text>
          <Text style={s.logoSub}>Livraison rapide au Liban 🛵</Text>
        </View>

        <View style={s.card}>
          <Text style={s.title}>Se connecter</Text>
          <Text style={s.sub}>Entre ton numéro pour continuer</Text>

          <Text style={s.label}>Numéro de téléphone</Text>
          <View style={s.phoneRow}>
            <View style={s.flagPill}>
              <Text style={s.flagTxt}>🇱🇧 +961</Text>
            </View>
            <TextInput
              style={s.phoneInput}
              placeholder="70 123 456"
              placeholderTextColor="#555"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={12}
            />
          </View>

          <View style={s.devBanner}>
            <Text style={s.devBannerTxt}>🔧 Mode dev — connexion sans vérification SMS</Text>
          </View>

          <TouchableOpacity style={s.btn} onPress={loginDirect} disabled={loading}>
            <Text style={s.btnText}>{loading ? 'Connexion...' : 'Entrer →'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.linkBtn} onPress={() => router.push('/register')}>
            <Text style={s.linkText}>
              Pas encore de compte ? <Text style={s.linkAccent}>Créer un compte</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <Modal visible={langModal} transparent animationType="fade" onRequestClose={() => setLangModal(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setLangModal(false)}>
          <View style={s.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={s.modalTitle}>Langue</Text>
            {LANGUAGES.map(l => (
              <TouchableOpacity
                key={l.code}
                style={[s.modalOption, lang === l.code && s.modalOptionActive]}
                onPress={async () => { await setLang(l.code); setLangModal(false) }}
              >
                <Text style={s.modalFlag}>{l.flag}</Text>
                <Text style={[s.modalLabel, lang === l.code && { color: '#fff' }]}>{l.label}</Text>
                {lang === l.code && <View style={s.modalCheck} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#111' },
  scroll:           { flexGrow: 1, justifyContent: 'center', padding: 24 },
  langBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  langBtnFlag:      { fontSize: 16 },
  langBtnTxt:       { color: '#888', fontSize: 13, fontWeight: '600' },
  logoBox:          { alignItems: 'center', marginBottom: 32 },
  logoEmoji:        { fontSize: 64, marginBottom: 12 },
  logoName:         { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  logoSub:          { color: '#888', fontSize: 14, marginTop: 4, textAlign: 'center' },
  card:             { backgroundColor: '#1e1e1e', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#2a2a2a' },
  title:            { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  sub:              { color: '#888', fontSize: 14, marginBottom: 24 },
  label:            { color: '#888', fontSize: 12, marginBottom: 6 },
  phoneRow:         { flexDirection: 'row', gap: 8, marginBottom: 16 },
  flagPill:         { backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  flagTxt:          { color: '#fff', fontSize: 14, fontWeight: '600' },
  phoneInput:       { flex: 1, backgroundColor: '#111', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#2a2a2a', letterSpacing: 1 },
  devBanner:        { backgroundColor: '#1a1a0a', borderRadius: 10, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: '#3a3a1a' },
  devBannerTxt:     { color: '#8a8a3a', fontSize: 12, textAlign: 'center' },
  btn:              { backgroundColor: '#FF6B35', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#FF6B35', shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  btnText:          { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  linkBtn:          { marginTop: 20, alignItems: 'center' },
  linkText:         { color: '#888', fontSize: 14 },
  linkAccent:       { color: '#FF6B35', fontWeight: '600' },
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox:         { backgroundColor: '#1e1e1e', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#2a2a2a' },
  modalTitle:       { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalOption:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  modalOptionActive:{ borderColor: '#FF6B35', backgroundColor: '#2a1a10' },
  modalFlag:        { fontSize: 22 },
  modalLabel:       { color: '#888', fontSize: 15, fontWeight: '600', flex: 1 },
  modalCheck:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B35' },
})