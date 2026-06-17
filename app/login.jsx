import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Modal } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useTranslation } from '../lib/LanguageContext'
import { LANGUAGES } from '../lib/i18n'

export default function LoginScreen() {
  const { t, lang, setLang } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [langModalVisible, setLangModalVisible] = useState(false)
  const [driverModalVisible, setDriverModalVisible] = useState(false)
  const router = useRouter()

  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]

  async function handleSelectLang(code) {
    await setLang(code)
    setLangModalVisible(false)
  }

  async function loginClient() {
    if (!email || !password) return Alert.alert(t('login.errorTitle'), t('login.fillAllFields'))
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) Alert.alert(t('login.errorTitle'), t('login.wrongCredentials'))
    else router.replace('/(tabs)')
  }

  async function loginLivreur() {
    if (!username || !password) return Alert.alert(t('login.errorTitle'), t('login.fillAllFields'))
    setLoading(true)
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('username', username.toLowerCase().trim())
      .eq('password', password)
      .eq('active', true)
      .single()
    setLoading(false)
    if (error || !data) return Alert.alert(t('login.errorTitle'), t('login.wrongDriverCredentials'))
    router.replace({ pathname: '/driver', params: { driverId: data.id, driverName: data.full_name } })
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <TouchableOpacity style={styles.langBtn} onPress={() => setLangModalVisible(true)}>
          <Text style={styles.langBtnFlag}>{currentLang.flag}</Text>
          <Text style={styles.langBtnTxt}>{currentLang.label}</Text>
        </TouchableOpacity>

        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>🍽️</Text>
          <Text style={styles.logoName}>{t('login.logoName')}</Text>
          <Text style={styles.logoSub}>{t('login.logoSub')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{t('login.title')}</Text>
          <Text style={styles.sub}>{t('login.subtitle')}</Text>

          <Text style={styles.label}>{t('login.email')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('login.emailPlaceholder')}
            placeholderTextColor="#555"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>{t('login.password')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('login.passwordPlaceholder')}
            placeholderTextColor="#555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.btn} onPress={loginClient} disabled={loading}>
            <Text style={styles.btnText}>{loading ? t('login.loggingIn') : t('login.loginBtn')}</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/register')}>
            <Text style={styles.linkText}>{t('login.noAccount')} <Text style={styles.linkAccent}>{t('login.createAccount')}</Text></Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.driverLink} onPress={() => setDriverModalVisible(true)}>
            <Text style={styles.driverLinkText}>
              {t('login.areYouDriver')}{' '}
              <Text style={styles.driverLinkAccent}>{t('login.loginAsDriver')} →</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Modal langue */}
      <Modal visible={langModalVisible} transparent animationType="fade" onRequestClose={() => setLangModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLangModalVisible(false)}>
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('language.title')}</Text>
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[styles.modalOption, lang === l.code && styles.modalOptionActive]}
                onPress={() => handleSelectLang(l.code)}
              >
                <Text style={styles.modalFlag}>{l.flag}</Text>
                <Text style={[styles.modalLabel, lang === l.code && styles.modalLabelActive]}>{l.label}</Text>
                {lang === l.code && <View style={styles.modalCheck} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal livreur */}
      <Modal visible={driverModalVisible} transparent animationType="slide" onRequestClose={() => setDriverModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDriverModalVisible(false)}>
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('login.driverTitle')}</Text>
            <Text style={styles.modalSub}>{t('login.driverSubtitle')}</Text>

            <Text style={styles.label}>{t('login.username')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('login.usernamePlaceholder')}
              placeholderTextColor="#555"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />

            <Text style={styles.label}>{t('login.password')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('login.passwordPlaceholder')}
              placeholderTextColor="#555"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity style={[styles.btn, styles.btnDriver]} onPress={loginLivreur} disabled={loading}>
              <Text style={styles.btnText}>{loading ? t('login.loggingIn') : t('login.driverBtn')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setDriverModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoBox: { alignItems: 'center', marginBottom: 28 },
  logoEmoji: { fontSize: 64, marginBottom: 12 },
  logoName: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  logoSub: { color: '#888', fontSize: 14, marginTop: 4 },
  card: { backgroundColor: '#1e1e1e', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#2a2a2a' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  sub: { color: '#888', fontSize: 14, marginBottom: 24 },
  label: { color: '#888', fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: '#111', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 16 },
  btn: { backgroundColor: '#FF6B35', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 4, shadowColor: '#FF6B35', shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  btnDriver: { backgroundColor: '#9C27B0', shadowColor: '#9C27B0' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2a2a2a' },
  dividerText: { color: '#555', fontSize: 12 },
  linkBtn: { alignItems: 'center', marginBottom: 14 },
  linkText: { color: '#888', fontSize: 14 },
  linkAccent: { color: '#FF6B35', fontWeight: '600' },
  driverLink: { alignItems: 'center' },
  driverLinkText: { color: '#555', fontSize: 12 },
  driverLinkAccent: { color: '#9C27B0', fontWeight: '600' },
  cancelBtn: { marginTop: 12, alignItems: 'center', padding: 12 },
  cancelBtnText: { color: '#555', fontSize: 14 },
  langBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: '#1e1e1e', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  langBtnFlag: { fontSize: 16 },
  langBtnTxt: { color: '#888', fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: '#1e1e1e', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#2a2a2a' },
  modalTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  modalSub: { color: '#888', fontSize: 13, marginBottom: 20, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  modalOptionActive: { borderColor: '#FF6B35', backgroundColor: '#2a1a10' },
  modalFlag: { fontSize: 22 },
  modalLabel: { color: '#888', fontSize: 15, fontWeight: '600', flex: 1 },
  modalLabelActive: { color: '#fff' },
  modalCheck: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B35' },
})