import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import {
  Alert, KeyboardAvoidingView,
  Modal,
  Platform, ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native'
import { useTranslation } from '../lib/LanguageContext'
import { LANGUAGES } from '../lib/i18n'
import { supabase } from '../lib/supabase'

// ─── Clé de stockage pour "rester connecté" ───────────────────────────────
const REMEMBER_KEY = 'lf_remember_phone'

export default function LoginScreen() {
  const { t, lang, setLang } = useTranslation()
  const router = useRouter()

  // ─── États communs ────────────────────────────────────────────────────────
  const [step, setStep] = useState(1)           // 1 = saisie téléphone, 2 = OTP
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [remember, setRemember] = useState(true) // coché par défaut
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  // ─── États modals ─────────────────────────────────────────────────────────
  const [langModalVisible, setLangModalVisible] = useState(false)
  const [driverModalVisible, setDriverModalVisible] = useState(false)

  // ─── Driver ───────────────────────────────────────────────────────────────
  const [driverUsername, setDriverUsername] = useState('')
  const [driverPassword, setDriverPassword] = useState('')

  const otpRefs = useRef([])
  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function formatPhone(raw) {
    const digits = raw.replace(/\D/g, '')
    if (digits.startsWith('00961')) return '+' + digits.slice(2)
    if (digits.startsWith('961'))   return '+' + digits
    if (digits.startsWith('0'))     return '+961' + digits.slice(1)
    return '+961' + digits
  }

  function startResendTimer() {
    setResendTimer(60)
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  // ─── Envoi OTP ────────────────────────────────────────────────────────────
  async function sendOtp() {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 7) return Alert.alert('Erreur', 'Entre un numéro de téléphone valide')

    setLoading(true)
    const formatted = formatPhone(phone)
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    setLoading(false)

    if (error) Alert.alert('Erreur', error.message)
    else { setStep(2); startResendTimer() }
  }

async function sendOtp() {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return Alert.alert('Erreur', 'Entre un numéro de téléphone valide')
  
  // BYPASS TEMPORAIRE - skip OTP
  router.replace('/(tabs)')
}

  // ─── Gestion champs OTP ───────────────────────────────────────────────────
  function handleOtpChange(val, idx) {
    const digits = val.replace(/\D/g, '')
    if (!digits && val !== '') return
    const newOtp = [...otp]
    if (digits.length === 6) {
      setOtp(digits.split(''))
      otpRefs.current[5]?.focus()
      return
    }
    newOtp[idx] = digits
    setOtp(newOtp)
    if (digits && idx < 5) otpRefs.current[idx + 1]?.focus()
  }

  function handleOtpKey(e, idx) {
    if (e.nativeEvent.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus()
    }
  }

  // ─── Vérification OTP + session persistante ───────────────────────────────
  async function verifyOtp() {
    const code = otp.join('')
    if (code.length !== 6) return Alert.alert('Erreur', 'Entre le code à 6 chiffres')

    setLoading(true)
    const formatted = formatPhone(phone)
    const { data, error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: code,
      type: 'sms',
    })

    if (error) {
      setLoading(false)
      return Alert.alert('Code incorrect', 'Vérifie le code ou renvoie-en un nouveau')
    }

    // Si "rester connecté" → on sauvegarde le numéro pour info
    // La session Supabase est gérée automatiquement par le client
    // On stocke juste un flag pour savoir si on doit refresher silencieusement
    if (remember) {
      await AsyncStorage.setItem(REMEMBER_KEY, formatted)
    } else {
      await AsyncStorage.removeItem(REMEMBER_KEY)
      // Session courte : on la révoque à la fermeture de l'app
      // (géré côté supabase client avec persistSession: false si besoin)
    }

    setLoading(false)
    router.replace('/(tabs)')
  }

  // ─── Login livreur ────────────────────────────────────────────────────────
  async function loginLivreur() {
    if (!driverUsername || !driverPassword)
      return Alert.alert(t('login.errorTitle'), t('login.fillAllFields'))

    setLoading(true)
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('username', driverUsername.toLowerCase().trim())
      .eq('password', driverPassword)
      .eq('active', true)
      .single()
    setLoading(false)

    if (error || !data)
      return Alert.alert(t('login.errorTitle'), t('login.wrongDriverCredentials'))

    router.replace({ pathname: '/driver', params: { driverId: data.id, driverName: data.full_name } })
  }

  // ─── STEP 1 : Numéro ──────────────────────────────────────────────────────
  if (step === 1) return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Sélecteur langue */}
        <TouchableOpacity style={s.langBtn} onPress={() => setLangModalVisible(true)}>
          <Text style={s.langBtnFlag}>{currentLang.flag}</Text>
          <Text style={s.langBtnTxt}>{currentLang.label}</Text>
        </TouchableOpacity>

        {/* Logo */}
        <View style={s.logoBox}>
          <Text style={s.logoEmoji}>🍽️</Text>
          <Text style={s.logoName}>Lebanon Food</Text>
          <Text style={s.logoSub}>Livraison rapide au Liban</Text>
        </View>

        <View style={s.card}>
          <Text style={s.title}>Se connecter</Text>
          <Text style={s.sub}>On t'envoie un code par SMS pour confirmer</Text>

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

          {/* ─── Case "Rester connecté" ─── */}
          <TouchableOpacity style={s.rememberRow} onPress={() => setRemember(r => !r)}>
            <View style={[s.checkbox, remember && s.checkboxChecked]}>
              {remember && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={s.rememberText}>Rester connecté</Text>
          </TouchableOpacity>

          <Text style={s.hint}>
            Un SMS de vérification sera envoyé à ce numéro.
          </Text>

          <TouchableOpacity style={s.btn} onPress={sendOtp} disabled={loading}>
            <Text style={s.btnText}>
              {loading ? 'Envoi...' : 'Recevoir le code SMS →'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.linkBtn} onPress={() => router.push('/register')}>
            <Text style={s.linkText}>
              Pas encore de compte ?{' '}
              <Text style={s.linkAccent}>Créer un compte</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.driverLink} onPress={() => setDriverModalVisible(true)}>
            <Text style={s.driverLinkText}>
              Tu es livreur ?{' '}
              <Text style={s.driverLinkAccent}>Connexion livreur →</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Modal langue */}
      <Modal visible={langModalVisible} transparent animationType="fade" onRequestClose={() => setLangModalVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setLangModalVisible(false)}>
          <View style={s.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={s.modalTitle}>Langue</Text>
            {LANGUAGES.map(l => (
              <TouchableOpacity
                key={l.code}
                style={[s.modalOption, lang === l.code && s.modalOptionActive]}
                onPress={async () => { await setLang(l.code); setLangModalVisible(false) }}
              >
                <Text style={s.modalFlag}>{l.flag}</Text>
                <Text style={[s.modalLabel, lang === l.code && s.modalLabelActive]}>{l.label}</Text>
                {lang === l.code && <View style={s.modalCheck} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal livreur */}
      <Modal visible={driverModalVisible} transparent animationType="slide" onRequestClose={() => setDriverModalVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setDriverModalVisible(false)}>
          <View style={s.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={s.modalTitle}>Connexion livreur</Text>
            <Text style={s.modalSub}>Accès réservé aux livreurs</Text>

            <Text style={s.label}>Nom d'utilisateur</Text>
            <TextInput
              style={s.input}
              placeholder="username"
              placeholderTextColor="#555"
              value={driverUsername}
              onChangeText={setDriverUsername}
              autoCapitalize="none"
            />

            <Text style={s.label}>Mot de passe</Text>
            <TextInput
              style={s.input}
              placeholder="••••••"
              placeholderTextColor="#555"
              value={driverPassword}
              onChangeText={setDriverPassword}
              secureTextEntry
            />

            <TouchableOpacity style={[s.btn, s.btnDriver]} onPress={loginLivreur} disabled={loading}>
              <Text style={s.btnText}>{loading ? 'Connexion...' : 'Se connecter →'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={() => setDriverModalVisible(false)}>
              <Text style={s.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </KeyboardAvoidingView>
  )

  // ─── STEP 2 : OTP ─────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <View style={s.logoBox}>
          <Text style={s.otpIcon}>📱</Text>
          <Text style={s.logoName}>Code de vérification</Text>
          <Text style={s.logoSub}>Envoyé au +961 {phone}</Text>
        </View>

        <View style={s.card}>
          <Text style={s.title}>Entre le code</Text>
          <Text style={s.sub}>Vérifie tes SMS et entre le code à 6 chiffres</Text>

          <View style={s.otpRow}>
            {otp.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={el => otpRefs.current[idx] = el}
                style={[s.otpBox, digit ? s.otpBoxFilled : null]}
                value={digit}
                onChangeText={val => handleOtpChange(val, idx)}
                onKeyPress={e => handleOtpKey(e, idx)}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
                textAlign="center"
              />
            ))}
          </View>

          <TouchableOpacity style={s.btn} onPress={verifyOtp} disabled={loading}>
            <Text style={s.btnText}>
              {loading ? 'Vérification...' : 'Confirmer →'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.resendBtn, resendTimer > 0 && s.resendBtnDisabled]}
            onPress={resendOtp}
            disabled={resendTimer > 0}
          >
            <Text style={[s.resendText, resendTimer > 0 && s.resendTextDisabled]}>
              {resendTimer > 0 ? `Renvoyer dans ${resendTimer}s` : 'Renvoyer le code'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.linkBtn} onPress={() => { setStep(1); setOtp(['','','','','','']) }}>
            <Text style={s.linkText}>
              ← <Text style={s.linkAccent}>Changer de numéro</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#111' },
  scroll:           { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoBox:          { alignItems: 'center', marginBottom: 32 },
  logoEmoji:        { fontSize: 64, marginBottom: 12 },
  otpIcon:          { fontSize: 56, marginBottom: 12 },
  logoName:         { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  logoSub:          { color: '#888', fontSize: 14, marginTop: 4, textAlign: 'center' },
  card:             { backgroundColor: '#1e1e1e', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#2a2a2a' },
  title:            { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  sub:              { color: '#888', fontSize: 14, marginBottom: 24 },
  label:            { color: '#888', fontSize: 12, marginBottom: 6 },
  input:            { backgroundColor: '#111', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 16 },
  phoneRow:         { flexDirection: 'row', gap: 8, marginBottom: 12 },
  flagPill:         { backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  flagTxt:          { color: '#fff', fontSize: 14, fontWeight: '600' },
  phoneInput:       { flex: 1, backgroundColor: '#111', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#2a2a2a', letterSpacing: 1 },

  // ── Rester connecté ────────────────────────────────────────────────────────
  rememberRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 4 },
  checkbox:         { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#444', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  checkboxChecked:  { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  checkmark:        { color: '#fff', fontSize: 13, fontWeight: 'bold', lineHeight: 16 },
  rememberText:     { color: '#aaa', fontSize: 14 },

  hint:             { color: '#444', fontSize: 12, marginBottom: 20, lineHeight: 18 },
  btn:              { backgroundColor: '#FF6B35', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4, shadowColor: '#FF6B35', shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  btnDriver:        { backgroundColor: '#9C27B0', shadowColor: '#9C27B0' },
  btnText:          { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  linkBtn:          { marginTop: 20, alignItems: 'center' },
  linkText:         { color: '#888', fontSize: 14 },
  linkAccent:       { color: '#FF6B35', fontWeight: '600' },
  driverLink:       { alignItems: 'center', marginTop: 14 },
  driverLinkText:   { color: '#555', fontSize: 12 },
  driverLinkAccent: { color: '#9C27B0', fontWeight: '600' },
  cancelBtn:        { marginTop: 12, alignItems: 'center', padding: 12 },
  cancelBtnText:    { color: '#555', fontSize: 14 },
  langBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  langBtnFlag:      { fontSize: 16 },
  langBtnTxt:       { color: '#888', fontSize: 13, fontWeight: '600' },
  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox:         { backgroundColor: '#1e1e1e', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#2a2a2a' },
  modalTitle:       { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  modalSub:         { color: '#888', fontSize: 13, marginBottom: 20, textAlign: 'center' },
  modalOption:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  modalOptionActive:{ borderColor: '#FF6B35', backgroundColor: '#2a1a10' },
  modalFlag:        { fontSize: 22 },
  modalLabel:       { color: '#888', fontSize: 15, fontWeight: '600', flex: 1 },
  modalLabelActive: { color: '#fff' },
  modalCheck:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B35' },
  otpRow:           { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 28 },
  otpBox:           { width: 44, height: 54, backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', color: '#fff', fontSize: 22, fontWeight: 'bold' },
  otpBoxFilled:     { borderColor: '#FF6B35', backgroundColor: '#1a0f09' },
  resendBtn:        { marginTop: 14, alignItems: 'center', padding: 10 },
  resendBtnDisabled:{ opacity: 0.4 },
  resendText:       { color: '#FF6B35', fontSize: 14, fontWeight: '600' },
  resendTextDisabled:{ color: '#888' },
})