import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useTranslation } from '../lib/LanguageContext'

export default function RegisterScreen() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function formatPhone(raw) {
    const digits = raw.replace(/\D/g, '')
    if (digits.startsWith('961')) return '+' + digits
    if (digits.startsWith('0')) return '+961' + digits.slice(1)
    return '+961' + digits
  }

  async function register() {
    if (!name || !phone || !email || !password) return Alert.alert(t('register.errorTitle'), t('register.fillAllFields'))
    if (password.length < 6) return Alert.alert(t('register.errorTitle'), t('register.passwordTooShort'))
    if (phone.replace(/\D/g, '').length < 7) return Alert.alert(t('register.errorTitle'), 'Entre un numéro de téléphone valide')

    setLoading(true)
    const formatted = formatPhone(phone)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, phone: formatted } }
    })
    setLoading(false)
    if (error) Alert.alert(t('register.errorTitle'), error.message)
    else router.replace('/(tabs)')
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>🍽️</Text>
          <Text style={styles.logoName}>Lebanon Food</Text>
          <Text style={styles.logoSub}>{t('register.subtitle')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{t('register.title')}</Text>
          <Text style={styles.sub}>Crée ton compte pour commander</Text>

          <Text style={styles.label}>{t('register.fullName')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('register.fullNamePlaceholder')}
            placeholderTextColor="#555"
            value={name}
            onChangeText={setName}
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

          <Text style={styles.label}>{t('register.email')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('register.emailPlaceholder')}
            placeholderTextColor="#555"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>{t('register.password')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('register.passwordPlaceholder')}
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.btn} onPress={register} disabled={loading}>
            <Text style={styles.btnText}>{loading ? t('register.registering') : t('register.registerBtn')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/login')}>
            <Text style={styles.linkText}>{t('register.haveAccount')} <Text style={styles.linkAccent}>{t('register.login')}</Text></Text>
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
  logoName: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  logoSub: { color: '#888', fontSize: 14, marginTop: 4 },
  card: { backgroundColor: '#1e1e1e', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#2a2a2a' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  sub: { color: '#888', fontSize: 14, marginBottom: 24 },
  label: { color: '#888', fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: '#111', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 16 },
  phoneRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  flagPill: { backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  flagTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  phoneInput: { flex: 1, backgroundColor: '#111', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#2a2a2a', letterSpacing: 1 },
  btn: { backgroundColor: '#FF6B35', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4, shadowColor: '#FF6B35', shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  linkBtn: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#888', fontSize: 14 },
  linkAccent: { color: '#FF6B35', fontWeight: '600' },
})
