import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useTranslation } from '../lib/LanguageContext'

export default function ConfirmationScreen() {
  const { t } = useTranslation()
  const { phone, payMethod, orderId } = useLocalSearchParams()
  const router = useRouter()
  const scaleAnim = new Animated.Value(0)
  const [latestOrderId, setLatestOrderId] = useState(orderId || null)

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1, tension: 60, friction: 8, useNativeDriver: true
    }).start()

    // Si on n'a pas d'orderId, on récupère le dernier de ce téléphone
    if (!orderId && phone) {
      supabase
        .from('orders')
        .select('id')
        .eq('customer_phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
        .then(({ data }) => { if (data) setLatestOrderId(data.id) })
    }
  }, [])

  return (
    <View style={styles.container}>

      {/* Cercle animé */}
      <Animated.View style={[styles.circle, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.emoji}>🎉</Text>
      </Animated.View>

      <Text style={styles.title}>{t('confirmation.title')}</Text>
      <Text style={styles.sub}>
        {payMethod === 'whish'
          ? t('confirmation.subWhish')
          : t('confirmation.subCash')}
      </Text>

      {/* Étapes */}
      <View style={styles.stepsBox}>
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, { backgroundColor: '#4CAF50' }]} />
          <View>
            <Text style={styles.stepTxt}>{t('confirmation.step1Title')}</Text>
            <Text style={styles.stepSub}>{t('confirmation.step1Sub')}</Text>
          </View>
        </View>
        <View style={styles.stepConnector} />
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, { backgroundColor: '#2196F3' }]} />
          <View>
            <Text style={styles.stepTxt}>{t('confirmation.step2Title')}</Text>
            <Text style={styles.stepSub}>{t('confirmation.step2Sub')}</Text>
          </View>
        </View>
        <View style={styles.stepConnector} />
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, { backgroundColor: '#9C27B0' }]} />
          <View>
            <Text style={styles.stepTxt}>{t('confirmation.step3Title')}</Text>
            <Text style={styles.stepSub}>{t('confirmation.step3Sub')}</Text>
          </View>
        </View>
        <View style={styles.stepConnector} />
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, { backgroundColor: '#FF6B35' }]} />
          <View>
            <Text style={styles.stepTxt}>{t('confirmation.step4Title')}</Text>
            <Text style={styles.stepSub}>{t('confirmation.step4Sub')}</Text>
          </View>
        </View>
      </View>

      {/* Bouton suivi */}
      {latestOrderId && (
        <TouchableOpacity
          style={styles.trackBtn}
          onPress={() => router.push({ pathname: '/tracking', params: { orderId: latestOrderId } })}
        >
          <Text style={styles.trackBtnTxt}>{t('confirmation.trackBtn')}</Text>
        </TouchableOpacity>
      )}

      {/* Bouton accueil */}
      <TouchableOpacity style={styles.homeBtn} onPress={() => router.push('/')}>
        <Text style={styles.homeBtnTxt}>{t('confirmation.homeBtn')}</Text>
      </TouchableOpacity>

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d', justifyContent: 'center', alignItems: 'center', padding: 28 },

  circle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#1e1e1e', justifyContent: 'center',
    alignItems: 'center', marginBottom: 20,
    borderWidth: 2, borderColor: '#FF6B35'
  },
  emoji: { fontSize: 44 },

  title: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 10 },
  sub: { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 },

  stepsBox: { backgroundColor: '#141414', borderRadius: 18, padding: 20, width: '100%', marginBottom: 24, borderWidth: 1, borderColor: '#1f1f1f' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepDot: { width: 12, height: 12, borderRadius: 6 },
  stepTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  stepSub: { color: '#555', fontSize: 12, marginTop: 2 },
  stepConnector: { width: 2, height: 18, backgroundColor: '#1f1f1f', marginLeft: 5, marginVertical: 4 },

  trackBtn: {
    width: '100%', backgroundColor: '#9C27B0',
    borderRadius: 16, padding: 17, alignItems: 'center', marginBottom: 12,
    shadowColor: '#9C27B0', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8
  },
  trackBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  homeBtn: { width: '100%', backgroundColor: '#141414', borderRadius: 16, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  homeBtnTxt: { color: '#555', fontSize: 15, fontWeight: '600' },
})