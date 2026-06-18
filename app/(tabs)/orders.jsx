import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, RefreshControl, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from '../../lib/LanguageContext'
import { registerForPushNotifications, sendLocalNotif, STATUS_MESSAGES } from '../../lib/notifications'
import { supabase } from '../../lib/supabase'

const ORANGE = '#FF6B35'
const BG = '#0a0a0a'
const CARD = '#111'
const BORDER = '#1c1c1c'
const WHITE = '#fff'

export default function OrdersScreen() {
  const { t } = useTranslation()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userPhone, setUserPhone] = useState(null)
  const router = useRouter()
  const prevStatusMapRef = useRef({})
  const fadeAnim = useRef(new Animated.Value(0)).current

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
    registerForPushNotifications(null)
    let sub = null

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const phone = user.user_metadata?.phone
      setUserPhone(phone)
      await fetchOrders(phone)

      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start()

      sub = supabase.channel('orders-changes-' + phone)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            const order = payload.new
            const prevStatus = prevStatusMapRef.current[order.id]
            const newStatus = order.status
            if (newStatus !== prevStatus && STATUS_MESSAGES[newStatus]) {
              const msg = STATUS_MESSAGES[newStatus]
              sendLocalNotif({ title: msg.title, body: msg.body, data: { orderId: order.id, type: 'status' }, channel: 'order-status' })
            }
            prevStatusMapRef.current[order.id] = newStatus
          }
          fetchOrders(phone)
        }).subscribe()

      supabase.channel('chat-all-' + phone)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_messages' }, (payload) => {
          if (payload.new.sender === 'restaurant') {
            sendLocalNotif({ title: '💬 Message du restaurant', body: payload.new.message, data: { orderId: payload.new.order_id, type: 'chat' }, channel: 'chat' })
          }
        }).subscribe()
    }
    init()
    return () => { if (sub) supabase.removeChannel(sub) }
  }, [])

  async function fetchOrders(phone) {
    const { data } = await supabase
      .from('orders').select('*, restaurants(name)')
      .eq('customer_phone', phone)
      .neq('status', 'preorder')
      .order('created_at', { ascending: false })
    if (data) {
      data.forEach(o => { if (!prevStatusMapRef.current[o.id]) prevStatusMapRef.current[o.id] = o.status })
      setOrders(data)
    }
    setLoading(false)
    setRefreshing(false)
  }

  function onRefresh() {
    setRefreshing(true)
    if (userPhone) fetchOrders(userPhone)
  }

  const activeOrders = orders.filter(o => o.status !== 'delivered' && o.status !== 'refused' && o.status !== 'preorder')
  const pastOrders   = orders.filter(o => o.status === 'delivered' || o.status === 'refused')

  function OrderCard({ order, isActive }) {
    const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
    const items = order.items || []
    const currentStep = status.step
    const canTrack = order.status === 'on_the_way' && order.driver_id

    return (
      <TouchableOpacity
        style={[s.orderCard, isActive && { borderColor: status.color + '30' }, order.status === 'refused' && s.cardRefused]}
        onPress={() => router.push({ pathname: '/tracking', params: { orderId: order.id } })}
        activeOpacity={0.85}
      >
        {/* Header */}
        <View style={s.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardResto}>{order.restaurants?.name || 'Restaurant'}</Text>
            <Text style={s.cardDate}>
              {new Date(order.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              })}
            </Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: status.color + '18', borderColor: status.color + '50' }]}>
            <Text style={s.statusEmoji}>{status.emoji}</Text>
            <Text style={[s.statusTxt, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Progress stepper */}
        {order.status !== 'refused' && (
          <View style={s.stepper}>
            {STEPS.map((step, i) => {
              const done = i <= currentStep
              const isCurrent = i === currentStep
              return (
                <View key={step.key} style={s.stepWrapper}>
                  <View style={[
                    s.stepCircle,
                    done && { backgroundColor: status.color + '20', borderColor: status.color + '80' },
                    isCurrent && { borderWidth: 2 },
                  ]}>
                    <Text style={s.stepEmoji}>{step.emoji}</Text>
                  </View>
                  <Text style={[s.stepLbl, done && { color: status.color }]} numberOfLines={1}>{step.label}</Text>
                  {i < STEPS.length - 1 && (
                    <View style={[s.stepConnector, done && i < currentStep && { backgroundColor: status.color + '60' }]} />
                  )}
                </View>
              )
            })}
          </View>
        )}

        {/* Items */}
        <View style={s.itemsRow}>
          {items.slice(0, 3).map((item, i) => (
            <View key={i} style={s.itemPill}>
              <Text style={s.itemPillTxt}>{item.qty}×  {item.name}</Text>
            </View>
          ))}
          {items.length > 3 && (
            <View style={s.itemPill}>
              <Text style={s.itemPillTxt}>+{items.length - 3}</Text>
            </View>
          )}
        </View>

        {/* Restaurant message */}
        {order.restaurant_message ? (
          <View style={s.msgBox}>
            <Text style={s.msgTxt}>💬  {order.restaurant_message}</Text>
          </View>
        ) : null}

        {/* Refusal reason */}
        {order.status === 'refused' && order.refusal_reason && (
          <View style={s.refusalBox}>
            <Text style={s.refusalTxt}>❌  {order.refusal_reason}</Text>
          </View>
        )}

        {/* Whish status */}
        {order.payment_method === 'whish' && (
          <View style={[s.whishBadge, order.payment_status === 'confirmed' ? s.whishOk : s.whishPending]}>
            <Text style={s.whishBadgeTxt}>
              {order.payment_status === 'confirmed' ? t('orders.whishConfirmed') : t('orders.whishWaiting')}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.cardFooter}>
          <Text style={s.cardTotal}>${order.total}</Text>
          {canTrack ? (
            <View style={s.liveBtn}>
              <View style={s.liveDot} />
              <Text style={s.liveBtnTxt}>{t('orders.trackLive')}</Text>
            </View>
          ) : (
            <Text style={s.tapHint}>{t('orders.tapDetails')}  →</Text>
          )}
        </View>

        {/* Driver */}
        {order.driver_name && order.status !== 'delivered' && (
          <View style={s.driverRow}>
            <View style={s.driverAvatar}>
              <Text style={s.driverAvatarTxt}>{order.driver_name[0]?.toUpperCase()}</Text>
            </View>
            <Text style={s.driverName}>🛵  {order.driver_name}</Text>
            <Text style={s.driverLabel}>{t('orders.yourDriver')}</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* Fixed header */}
      <View style={s.topBar}>
        <Text style={s.topTitle}>{t('orders.title')}</Text>
        {userPhone && (
          <View style={s.phonePill}>
            <Text style={s.phonePillTxt}>📱  {userPhone}</Text>
          </View>
        )}
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
      >
        {loading && (
          <View style={s.loadingBox}>
            <Text style={s.loadingTxt}>{t('orders.loading')}</Text>
          </View>
        )}

        {!loading && orders.length === 0 && (
          <View style={s.emptyBox}>
            <Text style={s.emptyEmoji}>🍽️</Text>
            <Text style={s.emptyTitle}>{t('orders.empty')}</Text>
            <Text style={s.emptySub}>{t('orders.emptySub')}</Text>
          </View>
        )}

        {activeOrders.length > 0 && (
          <>
            <View style={s.secRow}>
              <Text style={s.secLabel}>{t('orders.ongoing')}</Text>
              <View style={[s.secBadge, { backgroundColor: ORANGE + '18', borderColor: ORANGE + '40' }]}>
                <View style={[s.secDot, { backgroundColor: ORANGE }]} />
                <Text style={[s.secBadgeTxt, { color: ORANGE }]}>{activeOrders.length}</Text>
              </View>
            </View>
            {activeOrders.map(o => <OrderCard key={o.id} order={o} isActive />)}
          </>
        )}

        {pastOrders.length > 0 && (
          <>
            <View style={s.secRow}>
              <Text style={s.secLabel}>{t('orders.history')}</Text>
              <Text style={s.secCount}>{pastOrders.length}</Text>
            </View>
            {pastOrders.map(o => <OrderCard key={o.id} order={o} isActive={false} />)}
          </>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: BG },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0c0c0c',
    paddingTop: 62, paddingBottom: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  topTitle:     { color: WHITE, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  phonePill:    { backgroundColor: CARD, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: BORDER },
  phonePillTxt: { color: '#333', fontSize: 12 },

  scroll:       { padding: 16, paddingTop: 18 },
  loadingBox:   { alignItems: 'center', marginTop: 60 },
  loadingTxt:   { color: '#2a2a2a', fontSize: 14 },

  // Section headers
  secRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 6 },
  secLabel:     { color: '#2a2a2a', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  secBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  secDot:       { width: 5, height: 5, borderRadius: 3 },
  secBadgeTxt:  { fontSize: 12, fontWeight: '700' },
  secCount:     { color: '#2a2a2a', fontSize: 12, fontWeight: '600' },

  // Order card
  orderCard:    { backgroundColor: CARD, borderRadius: 22, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: BORDER },
  cardRefused:  { opacity: 0.5 },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  cardResto:    { color: WHITE, fontWeight: '800', fontSize: 16, marginBottom: 3 },
  cardDate:     { color: '#333', fontSize: 11 },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  statusEmoji:  { fontSize: 11 },
  statusTxt:    { fontSize: 12, fontWeight: '700' },

  // Stepper
  stepper:      { flexDirection: 'row', marginBottom: 16 },
  stepWrapper:  { flex: 1, alignItems: 'center', position: 'relative' },
  stepCircle:   { width: 34, height: 34, borderRadius: 17, backgroundColor: '#141414', borderWidth: 1, borderColor: '#222', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepEmoji:    { fontSize: 13 },
  stepLbl:      { color: '#2a2a2a', fontSize: 9, textAlign: 'center', fontWeight: '600' },
  stepConnector:{ position: 'absolute', top: 17, left: '50%', right: '-50%', height: 2, backgroundColor: '#1a1a1a', zIndex: -1 },

  // Items
  itemsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  itemPill:     { backgroundColor: '#161616', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, borderWidth: 1, borderColor: BORDER },
  itemPillTxt:  { color: '#444', fontSize: 12 },

  // Messages
  msgBox:       { backgroundColor: '#0d1e2e', borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#1a4060' },
  msgTxt:       { color: '#64B5F6', fontSize: 13 },
  refusalBox:   { backgroundColor: '#1a0808', borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#3a1010' },
  refusalTxt:   { color: '#EF9A9A', fontSize: 13 },

  // Whish
  whishBadge:   { borderRadius: 10, padding: 8, marginBottom: 12, borderWidth: 1 },
  whishPending: { backgroundColor: '#1a1000', borderColor: '#3a2500' },
  whishOk:      { backgroundColor: '#0a1a0a', borderColor: '#1a3a1a' },
  whishBadgeTxt:{ fontSize: 12, fontWeight: '600', color: '#aaa' },

  // Footer
  cardFooter:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTopWidth: 1, borderTopColor: BORDER },
  cardTotal:    { color: ORANGE, fontWeight: '800', fontSize: 18 },
  liveBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a0a2a', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#3a1a5a' },
  liveDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CE93D8' },
  liveBtnTxt:   { color: '#CE93D8', fontSize: 13, fontWeight: '600' },
  tapHint:      { color: '#2a2a2a', fontSize: 12 },

  // Driver
  driverRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: BORDER },
  driverAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#1a0a2a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3a1a5a' },
  driverAvatarTxt:{ color: '#CE93D8', fontWeight: '800', fontSize: 13 },
  driverName:   { flex: 1, color: '#CE93D8', fontWeight: '600', fontSize: 13 },
  driverLabel:  { color: '#2a2a2a', fontSize: 11 },

  // Empty
  emptyBox:     { alignItems: 'center', marginTop: 80 },
  emptyEmoji:   { fontSize: 52, marginBottom: 16 },
  emptyTitle:   { color: '#333', fontSize: 17, fontWeight: '600' },
  emptySub:     { color: '#222', fontSize: 13, marginTop: 6 },
})

