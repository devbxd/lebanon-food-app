import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from '../lib/LanguageContext'
import { supabase } from '../lib/supabase'

const ORANGE = '#FF6B35'
const BG = '#0a0a0a'
const CARD = '#111'
const BORDER = '#1c1c1c'
const WHITE = '#fff'

export default function ConfirmationScreen() {
  const { t } = useTranslation()
  const { phone, payMethod, orderId, isPreorder } = useLocalSearchParams()
  const router = useRouter()
  const scaleAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const [latestOrderId, setLatestOrderId] = useState(orderId || null)
  const preorder = isPreorder === '1'

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start()

    if (!orderId && phone) {
      supabase.from('orders').select('id')
        .eq('customer_phone', phone)
        .order('created_at', { ascending: false })
        .limit(1).single()
        .then(({ data }) => { if (data) setLatestOrderId(data.id) })
    }
  }, [])

  const accentColor = preorder ? '#9a98ff' : ORANGE
  const steps = preorder
    ? [
        { dot: '#9a98ff', title: '✅  Précommande reçue', sub: 'Ta commande est enregistrée dans le système' },
        { dot: '#4CAF50', title: `🔓  À l'ouverture`, sub: `Ta commande apparaît sur le dashboard du restaurant` },
        { dot: '#2196F3', title: '👨‍🍳  Préparation', sub: 'Le restaurant accepte et commence à préparer' },
        { dot: ORANGE,    title: '🛵  Livraison', sub: 'Un livreur prend en charge ta commande' },
      ]
    : [
        { dot: '#4CAF50', title: t('confirmation.step1Title'), sub: t('confirmation.step1Sub') },
        { dot: '#2196F3', title: t('confirmation.step2Title'), sub: t('confirmation.step2Sub') },
        { dot: '#9C27B0', title: t('confirmation.step3Title'), sub: t('confirmation.step3Sub') },
        { dot: ORANGE,    title: t('confirmation.step4Title'), sub: t('confirmation.step4Sub') },
      ]

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={[s.glow, { backgroundColor: accentColor }]} />

          <Animated.View style={[s.circleOuter, { borderColor: accentColor + '40', transform: [{ scale: scaleAnim }] }]}>
            <View style={[s.circleInner, { backgroundColor: accentColor + '15' }]}>
              <Text style={s.heroEmoji}>{preorder ? '⏰' : '🎉'}</Text>
            </View>
          </Animated.View>

          <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
            <Text style={s.heroTitle}>
              {preorder ? 'Précommande enregistrée !' : t('confirmation.title')}
            </Text>
            <Text style={s.heroSub}>
              {preorder
                ? 'Ta commande sera préparée dès que le restaurant ouvre.'
                : payMethod === 'whish'
                  ? t('confirmation.subWhish')
                  : t('confirmation.subCash')}
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Preorder notice ── */}
          {preorder && (
            <View style={s.noticeBanner}>
              <Text style={s.noticeIcon}>🕐</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.noticeTitle}>En attente d'ouverture</Text>
                <Text style={s.noticeSub}>
                  Dès que le restaurant ouvre, ta commande apparaît sur leur dashboard automatiquement.
                </Text>
              </View>
            </View>
          )}

          {/* ── Steps ── */}
          <View style={s.stepsCard}>
            <Text style={s.stepsLabel}>SUIVI DE COMMANDE</Text>
            {steps.map((step, i) => (
              <View key={i}>
                <View style={s.stepRow}>
                  <View style={[s.stepDot, { backgroundColor: step.dot }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.stepTitle}>{step.title}</Text>
                    <Text style={s.stepSub}>{step.sub}</Text>
                  </View>
                </View>
                {i < steps.length - 1 && <View style={s.stepLine} />}
              </View>
            ))}
          </View>

          {/* ── Boutons ── */}
          <View style={s.btnsWrap}>
            {latestOrderId && !preorder && (
              <TouchableOpacity
                style={s.trackBtn}
                onPress={() => router.replace({ pathname: '/tracking', params: { orderId: latestOrderId } })}
                activeOpacity={0.85}
              >
                <Text style={s.trackBtnTxt}>{t('confirmation.trackBtn')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={s.homeBtn}
              onPress={() => router.replace('/(tabs)')}
              activeOpacity={0.8}
            >
              <Text style={s.homeBtnTxt}>{t('confirmation.homeBtn')}</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll:    { padding: 20, paddingTop: 0 },

  hero: {
    alignItems: 'center',
    paddingTop: 80, paddingBottom: 36,
    position: 'relative', overflow: 'hidden',
  },
  glow: {
    position: 'absolute', top: 20,
    width: 200, height: 200, borderRadius: 100,
    opacity: 0.08, alignSelf: 'center',
  },
  circleOuter: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 22,
  },
  circleInner: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center',
  },
  heroEmoji:  { fontSize: 46 },
  heroTitle:  { color: WHITE, fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 10, letterSpacing: -0.5 },
  heroSub:    { color: '#444', fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },

  noticeBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#0e0e2a', borderRadius: 18,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#2a2a6a',
  },
  noticeIcon:  { fontSize: 22 },
  noticeTitle: { color: '#9a98ff', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  noticeSub:   { color: '#4a4a7a', fontSize: 12, lineHeight: 18 },

  stepsCard: {
    backgroundColor: CARD, borderRadius: 22,
    padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: BORDER,
  },
  stepsLabel: { color: '#222', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 18 },
  stepRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepDot:    { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  stepTitle:  { color: WHITE, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  stepSub:    { color: '#3a3a3a', fontSize: 12, lineHeight: 18 },
  stepLine:   { width: 2, height: 20, backgroundColor: '#1a1a1a', marginLeft: 4, marginVertical: 4 },

  btnsWrap: { gap: 10 },
  trackBtn: {
    backgroundColor: '#9C27B0', borderRadius: 18,
    padding: 17, alignItems: 'center',
    shadowColor: '#9C27B0', shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  trackBtnTxt: { color: WHITE, fontSize: 16, fontWeight: '800' },
  homeBtn: {
    backgroundColor: CARD, borderRadius: 18,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  homeBtnTxt: { color: '#333', fontSize: 15, fontWeight: '600' },
})