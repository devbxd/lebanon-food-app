import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native'
import { useTranslation } from '../lib/LanguageContext'
import { supabase } from '../lib/supabase'

export default function RegisterScreen() {
  const { t } = useTranslation()
  const [step, setStep] = useState(1) // 1 = infos, 2 = OTP
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const router = useRouter()
  const otpRefs = useRef([])

  function formatPhone(raw) {
    const digits = raw.replace(/\D/g, '')
    if (digits.startsWith('961')) return '+' + digits
    if (digits.startsWith('0')) return '+961' + digits.slice(1)
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

  async function sendOtp() {
    if (!name.trim()) return Alert.alert('Erreur', 'Entre ton prénom')
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 7) return Alert.alert('Erreur', 'Entre un numéro de téléphone valide')

    setLoading(true)
    const formatted = formatPhone(phone)
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    setLoading(false)

    if (error) {
      Alert.alert('Erreur', error.message)
    } else {
      setStep(2)
      startResendTimer()
    }
  }

  async function resendOtp() {
    if (resendTimer > 0) return
    setLoading(true)
    const formatted = formatPhone(phone)
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    setLoading(false)
    if (error) Alert.alert('Erreur', error.message)
    else startResendTimer()
  }

  function handleOtpChange(val, idx) {
    const digits = val.replace(/\D/g, '')
    if (!digits && val !== '') return
    const newOtp = [...otp]

    // Handle paste of full code
    if (digits.length === 6) {
      const arr = digits.split('')
      setOtp(arr)
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

    // Save full_name to profile
    if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: name.trim(),
        phone: formatted,
      })
    }

    setLoading(false)
    router.replace('/(tabs)')
  }

  // ─── STEP 1 : Infos ───────────────────────────────────────────────────────
  if (step === 1) return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>🍽️</Text>
          <Text style={styles.logoName}>Lebanon Food</Text>
          <Text style={styles.logoSub}>Livraison rapide au Liban</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.sub}>On t'envoie un code par SMS pour confirmer</Text>

          <Text style={styles.label}>Ton prénom</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex : Ahmad"
            placeholderTextColor="#555"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Numéro de téléphone</Text>
          <View style={styles.phoneRow}>
            <View style={styles.flagPill}>
              <Text style={styles.flagTxt}>🇱🇧 +961</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder="70 123 456"
              placeholderTextColor="#555"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={12}
            />
          </View>

          <Text style={styles.hint}>
            Un SMS avec un code de vérification sera envoyé à ce numéro.
          </Text>

          <TouchableOpacity style={styles.btn} onPress={sendOtp} disabled={loading}>
            <Text style={styles.btnText}>
              {loading ? 'Envoi...' : 'Recevoir le code SMS →'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/login')}>
            <Text style={styles.linkText}>
              Déjà un compte ? <Text style={styles.linkAccent}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )

  // ─── STEP 2 : OTP ─────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoBox}>
          <Text style={styles.otpIcon}>📱</Text>
          <Text style={styles.logoName}>Code de vérification</Text>
          <Text style={styles.logoSub}>Envoyé au +961 {phone}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Entre le code</Text>
          <Text style={styles.sub}>Vérifie tes SMS et entre le code à 6 chiffres</Text>

          <View style={styles.otpRow}>
            {otp.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={el => otpRefs.current[idx] = el}
                style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
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

          <TouchableOpacity style={styles.btn} onPress={verifyOtp} disabled={loading}>
            <Text style={styles.btnText}>
              {loading ? 'Vérification...' : 'Confirmer →'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resendBtn, resendTimer > 0 && styles.resendBtnDisabled]}
            onPress={resendOtp}
            disabled={resendTimer > 0}
          >
            <Text style={[styles.resendText, resendTimer > 0 && styles.resendTextDisabled]}>
              {resendTimer > 0 ? `Renvoyer dans ${resendTimer}s` : 'Renvoyer le code'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => { setStep(1); setOtp(['','','','','','']) }}>
            <Text style={styles.linkText}>
              ← <Text style={styles.linkAccent}>Changer de numéro</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoBox: { alignItems: 'center', marginBottom: 32 },
  logoEmoji: { fontSize: 64, marginBottom: 12 },
  otpIcon: { fontSize: 56, marginBottom: 12 },
  logoName: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  logoSub: { color: '#888', fontSize: 14, marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: '#1e1e1e', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#2a2a2a' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  sub: { color: '#888', fontSize: 14, marginBottom: 24 },
  label: { color: '#888', fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: '#111', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 16 },
  phoneRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  flagPill: { backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  flagTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  phoneInput: { flex: 1, backgroundColor: '#111', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#2a2a2a', letterSpacing: 1 },
  hint: { color: '#444', fontSize: 12, marginBottom: 20, lineHeight: 18 },
  btn: { backgroundColor: '#FF6B35', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4, shadowColor: '#FF6B35', shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  linkBtn: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#888', fontSize: 14 },
  linkAccent: { color: '#FF6B35', fontWeight: '600' },
  otpRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 28 },
  otpBox: { width: 44, height: 54, backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', color: '#fff', fontSize: 22, fontWeight: 'bold' },
  otpBoxFilled: { borderColor: '#FF6B35', backgroundColor: '#1a0f09' },
  resendBtn: { marginTop: 14, alignItems: 'center', padding: 10 },
  resendBtnDisabled: { opacity: 0.4 },
  resendText: { color: '#FF6B35', fontSize: 14, fontWeight: '600' },
  resendTextDisabled: { color: '#888' },
})

