import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useTranslation } from '../../lib/LanguageContext'

export default function OrdersScreen() {
  const { t } = useTranslation()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userPhone, setUserPhone] = useState(null)
  const router = useRouter()

  const STATUS_CONFIG = {
    pending:    { label: t('orders.pending'),    emoji: '⏳', color: '#FF9800', step: 0 },
    preparing:  { label: t('orders.preparing'),  emoji: '👨‍🍳', color: '#2196F3', step: 1 },
    on_the_way: { label: t('orders.onTheWay'),   emoji: '🛵', color: '#9C27B0', step: 2 },
    delivered:  { label: t('orders.delivered'),  emoji: '✅', color: '#4CAF50', step: 3 },
    refused:    { label: t('orders.refused'),    emoji: '❌', color: '#f44336', step: -1 },
  }

  const STEPS = [
    { key: 'pending',    emoji: '⏳', label: t('orders.stepReceived') },
    { key: 'preparing',  emoji: '👨‍🍳', label: t('orders.stepPreparing') },
    { key: 'on_the_way', emoji: '🛵', label: t('orders.stepOnTheWay') },
    { key: 'delivered',  emoji: '✅', label: t('orders.stepDelivered') },
  ]

  useEffect(() => {
    let sub = null
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const phone = user.user_metadata?.phone
      setUserPhone(phone)
      await fetchOrders(phone)
      sub = supabase
        .channel('orders-changes-' + phone)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders(phone))
        .subscribe()
    }
    init()
    return () => { if (sub) supabase.removeChannel(sub) }
  }, [])

  async function fetchOrders(phone) {
    const { data } = await supabase
      .from('orders')
      .select('*, restaurants(name)')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
    if (data) setOrders(data)
    setLoading(false)
    setRefreshing(false)
  }

  function onRefresh() {
    setRefreshing(true)
    if (userPhone) fetchOrders(userPhone)
  }

  const activeOrders = orders.filter(o => o.status !== 'delivered' && o.status !== 'refused')
  const pastOrders = orders.filter(o => o.status === 'delivered' || o.status === 'refused')

  function renderOrder(order, isActive) {
    const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
    const items = order.items || []
    const currentStep = status.step
    const canTrack = order.status === 'on_the_way' && order.driver_id

    return (
      <TouchableOpacity
        key={order.id}
        style={[styles.orderCard, isActive && styles.orderCardActive, order.status === 'refused' && styles.orderCardRefused]}
        onPress={() => router.push({ pathname: '/tracking', params: { orderId: order.id } })}
        activeOpacity={0.85}
      >
        {/* Header */}
        <View style={styles.orderHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderResto}>{order.restaurants?.name || 'Restaurant'}</Text>
            <Text style={styles.orderDate}>
              {new Date(order.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              })}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '22', borderColor: status.color + '66' }]}>
            <Text style={styles.statusEmoji}>{status.emoji}</Text>
            <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Progress steps (sauf refusée) */}
        {order.status !== 'refused' && (
          <View style={styles.stepsRow}>
            {STEPS.map((step, i) => {
              const done = i <= currentStep
              const isCurrent = i === currentStep
              return (
                <View key={step.key} style={styles.stepWrapper}>
                  <View style={[
                    styles.stepCircle,
                    done && { backgroundColor: status.color + '22', borderColor: status.color },
                    isCurrent && styles.stepCircleCurrent,
                  ]}>
                    <Text style={styles.stepEmoji}>{step.emoji}</Text>
                  </View>
                  <Text style={[styles.stepLabel, done && { color: status.color }]}>{step.label}</Text>
                  {i < STEPS.length - 1 && (
                    <View style={[styles.stepLine, done && i < currentStep && { backgroundColor: status.color }]} />
                  )}
                </View>
              )
            })}
          </View>
        )}

        {/* Articles */}
        <View style={styles.itemsRow}>
          {items.slice(0, 3).map((item, i) => (
            <View key={i} style={styles.itemPill}>
              <Text style={styles.itemPillTxt}>{item.qty}x {item.name}</Text>
            </View>
          ))}
          {items.length > 3 && (
            <View style={styles.itemPill}>
              <Text style={styles.itemPillTxt}>+{items.length - 3}</Text>
            </View>
          )}
        </View>

        {/* Message restaurant */}
        {order.restaurant_message ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageTitle}>💬 {order.restaurant_message}</Text>
          </View>
        ) : null}

        {/* Refus */}
        {order.status === 'refused' && order.refusal_reason && (
          <View style={styles.refusalBox}>
            <Text style={styles.refusalText}>❌ {order.refusal_reason}</Text>
          </View>
        )}

        {/* Whish badge */}
        {order.payment_method === 'whish' && (
          <View style={[styles.whishBadge, order.payment_status === 'confirmed' ? styles.whishConfirmed : styles.whishWaiting]}>
            <Text style={styles.whishBadgeText}>
              {order.payment_status === 'confirmed' ? t('orders.whishConfirmed') : t('orders.whishWaiting')}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.orderFooter}>
          <Text style={styles.orderTotal}>${order.total}</Text>
          {canTrack ? (
            <View style={styles.trackBtn}>
              <Text style={styles.trackBtnTxt}>{t('orders.trackLive')}</Text>
            </View>
          ) : (
            <Text style={styles.tapHint}>{t('orders.tapDetails')}</Text>
          )}
        </View>

        {/* Livreur assigné */}
        {order.driver_name && order.status !== 'delivered' && (
          <View style={styles.driverRow}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarTxt}>{order.driver_name[0]?.toUpperCase()}</Text>
            </View>
            <Text style={styles.driverName}>🛵 {order.driver_name}</Text>
            <Text style={styles.driverLabel}>{t('orders.yourDriver')}</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />}
      >
        <Text style={styles.title}>{t('orders.title')}</Text>
        {userPhone && <Text style={styles.subtitle}>📱 {userPhone}</Text>}

        {loading && <Text style={styles.loading}>{t('orders.loading')}</Text>}

        {!loading && orders.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={styles.emptyText}>{t('orders.empty')}</Text>
            <Text style={styles.emptySubText}>{t('orders.emptySub')}</Text>
          </View>
        )}

        {activeOrders.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{t('orders.ongoing')}</Text>
            {activeOrders.map(o => renderOrder(o, true))}
          </>
        )}

        {pastOrders.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>{t('orders.history')}</Text>
            {pastOrders.map(o => renderOrder(o, false))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  scroll: { padding: 20, paddingTop: 60 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#555', fontSize: 13, marginBottom: 28 },
  loading: { color: '#555', textAlign: 'center', marginTop: 40 },
  sectionLabel: { color: '#555', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 8 },

  emptyBox: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyText: { color: '#555', fontSize: 17, fontWeight: '600' },
  emptySubText: { color: '#333', fontSize: 13, marginTop: 6 },

  orderCard: { backgroundColor: '#141414', borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#1f1f1f' },
  orderCardActive: { borderColor: '#FF6B3544' },
  orderCardRefused: { opacity: 0.6 },

  orderHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  orderResto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  orderDate: { color: '#555', fontSize: 12, marginTop: 3 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  statusEmoji: { fontSize: 12 },
  statusLabel: { fontSize: 12, fontWeight: '700' },

  stepsRow: { flexDirection: 'row', marginBottom: 14, position: 'relative' },
  stepWrapper: { flex: 1, alignItems: 'center', position: 'relative' },
  stepCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1f1f1f', borderWidth: 1, borderColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepCircleCurrent: { borderWidth: 2 },
  stepEmoji: { fontSize: 14 },
  stepLabel: { color: '#444', fontSize: 10, textAlign: 'center' },
  stepLine: { position: 'absolute', top: 18, left: '50%', right: '-50%', height: 2, backgroundColor: '#1f1f1f', zIndex: -1 },

  itemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  itemPill: { backgroundColor: '#1f1f1f', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  itemPillTxt: { color: '#777', fontSize: 12 },

  messageBox: { backgroundColor: '#2196F310', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#2196F325' },
  messageTitle: { color: '#90CAF9', fontSize: 13 },

  refusalBox: { backgroundColor: '#f4433610', borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#f4433630' },
  refusalText: { color: '#ff8888', fontSize: 13 },

  whishBadge: { borderRadius: 8, padding: 8, marginBottom: 10, borderWidth: 1 },
  whishWaiting: { backgroundColor: '#FF980012', borderColor: '#FF980030' },
  whishConfirmed: { backgroundColor: '#4CAF5012', borderColor: '#4CAF5030' },
  whishBadgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  orderTotal: { color: '#FF6B35', fontWeight: '700', fontSize: 17 },
  trackBtn: { backgroundColor: '#9C27B022', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#9C27B044' },
  trackBtnTxt: { color: '#CE93D8', fontSize: 13, fontWeight: '600' },
  tapHint: { color: '#333', fontSize: 12 },

  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  driverAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#9C27B022', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#9C27B044' },
  driverAvatarTxt: { color: '#CE93D8', fontWeight: '700', fontSize: 14 },
  driverName: { flex: 1, color: '#CE93D8', fontWeight: '600', fontSize: 14 },
  driverLabel: { color: '#555', fontSize: 12 },
})

