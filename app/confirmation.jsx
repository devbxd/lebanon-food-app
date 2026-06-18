import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from '../lib/LanguageContext'
import { supabase } from '../lib/supabase'

export default function ConfirmationScreen() {
  const { t } = useTranslation()
  const { phone, payMethod, orderId, isPreorder } = useLocalSearchParams()
  const router = useRouter()
  const scaleAnim = useRef(new Animated.Value(0)).current
  const [latestOrderId, setLatestOrderId] = useState(orderId || null)

  const preorder = isPreorder === '1'

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1, tension: 60, friction: 8, useNativeDriver: true
    }).start()

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
      <Animated.View style={[
        styles.circle,
        { transform: [{ scale: scaleAnim }] },
        preorder && styles.circlePreorder
      ]}>
        <Text style={styles.emoji}>{preorder ? '⏰' : '🎉'}</Text>
      </Animated.View>

      <Text style={styles.title}>
        {preorder ? 'Précommande enregistrée !' : t('confirmation.title')}
      </Text>

      <Text style={styles.sub}>
        {preorder
          ? 'Ta commande est bien reçue. Elle sera préparée et livrée dès que le restaurant ouvrira ses portes.'
          : payMethod === 'whish'
            ? t('confirmation.subWhish')
            : t('confirmation.subCash')}
      </Text>

      {/* Bannière précommande */}
      {preorder && (
        <View style={styles.preorderBox}>
          <Text style={styles.preorderIcon}>🕐</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.preorderTitle}>En attente d'ouverture</Text>
            <Text style={styles.preorderSub}>
              Dès que le restaurant ouvre, ta commande apparaît directement sur leur dashboard et ils commencent à préparer.
            </Text>
          </View>
        </View>
      )}

      {/* Étapes */}
      <View style={styles.stepsBox}>
        {preorder ? (
          <>
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, { backgroundColor: '#7a78cf' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTxt}>✅ Précommande reçue</Text>
                <Text style={styles.stepSub}>Ta commande est enregistrée dans le système</Text>
              </View>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, { backgroundColor: '#4CAF50' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTxt}>🔓 À l'ouverture du restaurant</Text>
                <Text style={styles.stepSub}>Ta commande apparaît automatiquement sur leur dashboard</Text>
              </View>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, { backgroundColor: '#2196F3' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTxt}>👨‍🍳 Préparation</Text>
                <Text style={styles.stepSub}>Le restaurant accepte et commence à préparer</Text>
              </View>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, { backgroundColor: '#FF6B35' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTxt}>🛵 Livraison</Text>
                <Text style={styles.stepSub}>Un livreur prend en charge ta commande</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, { backgroundColor: '#4CAF50' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTxt}>{t('confirmation.step1Title')}</Text>
                <Text style={styles.stepSub}>{t('confirmation.step1Sub')}</Text>
              </View>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, { backgroundColor: '#2196F3' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTxt}>{t('confirmation.step2Title')}</Text>
                <Text style={styles.stepSub}>{t('confirmation.step2Sub')}</Text>
              </View>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, { backgroundColor: '#9C27B0' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTxt}>{t('confirmation.step3Title')}</Text>
                <Text style={styles.stepSub}>{t('confirmation.step3Sub')}</Text>
              </View>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, { backgroundColor: '#FF6B35' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTxt}>{t('confirmation.step4Title')}</Text>
                <Text style={styles.stepSub}>{t('confirmation.step4Sub')}</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Bouton suivi — masqué pour précommande car pas encore en préparation */}
      {latestOrderId && !preorder && (
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
  container: {
    flex: 1, backgroundColor: '#0d0d0d',
    justifyContent: 'center', alignItems: 'center', padding: 28
  },

  circle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#1e1e1e', justifyContent: 'center',
    alignItems: 'center', marginBottom: 20,
    borderWidth: 2, borderColor: '#FF6B35'
  },
  circlePreorder: { borderColor: '#7a78cf' },
  emoji: { fontSize: 44 },

  title: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  sub: { color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 20 },

  // Bannière précommande
  preorderBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#1a1a2e', borderRadius: 14,
    padding: 14, marginBottom: 20, width: '100%',
    borderWidth: 1, borderColor: '#3a3a6a'
  },
  preorderIcon: { fontSize: 22 },
  preorderTitle: { color: '#9a98ff', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  preorderSub: { color: '#5a5a8a', fontSize: 12, lineHeight: 18 },

  stepsBox: {
    backgroundColor: '#141414', borderRadius: 18,
    padding: 20, width: '100%', marginBottom: 24,
    borderWidth: 1, borderColor: '#1f1f1f'
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  stepTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  stepSub: { color: '#555', fontSize: 12, marginTop: 2 },
  stepConnector: {
    width: 2, height: 18, backgroundColor: '#1f1f1f',
    marginLeft: 5, marginVertical: 4
  },

  trackBtn: {
    width: '100%', backgroundColor: '#9C27B0',
    borderRadius: 16, padding: 17, alignItems: 'center', marginBottom: 12,
    shadowColor: '#9C27B0', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8
  },
  trackBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  homeBtn: {
    width: '100%', backgroundColor: '#141414',
    borderRadius: 16, padding: 15, alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2a2a'
  },
  homeBtnTxt: { color: '#555', fontSize: 15, fontWeight: '600' },
})