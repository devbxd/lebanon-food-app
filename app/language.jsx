import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from '../lib/LanguageContext'
import { LANGUAGES } from '../lib/i18n'

export default function LanguageScreen() {
  const { lang, setLang, t } = useTranslation()
  const [selected, setSelected] = useState(lang)
  const router = useRouter()

  async function handleContinue() {
    await setLang(selected)
    router.replace('/login')
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoBox}>
        <Text style={styles.logoEmoji}>🌍</Text>
        <Text style={styles.title}>{t('language.title')}</Text>
        <Text style={styles.subtitle}>{t('language.subtitle')}</Text>
      </View>

      <View style={styles.options}>
        {LANGUAGES.map((l) => (
          <TouchableOpacity
            key={l.code}
            style={[styles.option, selected === l.code && styles.optionActive]}
            onPress={() => setSelected(l.code)}
          >
            <Text style={styles.flag}>{l.flag}</Text>
            <Text style={[styles.label, selected === l.code && styles.labelActive]}>{l.label}</Text>
            {selected === l.code && <View style={styles.checkDot} />}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
        <Text style={styles.continueBtnTxt}>{t('language.continue')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d', justifyContent: 'center', padding: 28 },
  logoBox: { alignItems: 'center', marginBottom: 40 },
  logoEmoji: { fontSize: 56, marginBottom: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: '#666', fontSize: 14, textAlign: 'center' },

  options: { gap: 12, marginBottom: 32 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#141414', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#1f1f1f',
  },
  optionActive: { borderColor: '#FF6B35', backgroundColor: '#2a1a10' },
  flag: { fontSize: 28 },
  label: { color: '#888', fontSize: 17, fontWeight: '600', flex: 1 },
  labelActive: { color: '#fff' },
  checkDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6B35' },

  continueBtn: {
    backgroundColor: '#FF6B35', borderRadius: 16, padding: 17, alignItems: 'center',
    shadowColor: '#FF6B35', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  continueBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
})