import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import { useTranslation } from '../lib/LanguageContext'
import {
  registerForPushNotifications,
  sendLocalNotif,
  STATUS_MESSAGES,
} from '../lib/notifications'
import { supabase } from '../lib/supabase'

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window')

const ORANGE = '#FF6B35'
const BG = '#0a0a0a'
const CARD = '#141414'
const BORDER = '#1e1e1e'
const BORDER2 = '#252525'
const WHITE = '#fff'
const GRAY = '#888'
const GRAY2 = '#444'
const PURPLE = '#9C27B0'

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c54' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1b2a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
]

export default function TrackingScreen() {
  const { t } = useTranslation()
  const { orderId } = useLocalSearchParams()
  const router = useRouter()

  const [order, setOrder] = useState(null)
  const [driverLocation, setDriverLocation] = useState(null)
  const [loading, setLoading] = useState(true)

  // Chat
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [sendingMsg, setSendingMsg] = useState(false)
  const chatScrollRef = useRef(null)
  const chatSubRef = useRef(null)
  const chatSlideAnim = useRef(new Animated.Value(SCREEN_H)).current

  const mapRef = useRef(null)
  const pulseAnim = useRef(new Animated.Value(1)).current
  const prevStatusRef = useRef(null)
  const pushTokenRef = useRef(null)

  const STATUS_CONFIG = {
    pending:    { label: t('tracking.pending'),   emoji: '⏳', color: '#FF9800', step: 0 },
    preparing:  { label: t('tracking.preparing'), emoji: '👨‍🍳', color: '#2196F3', step: 1 },
    on_the_way: { label: t('tracking.onTheWay'),  emoji: '🛵', color: PURPLE,    step: 2 },
    delivered:  { label: t('tracking.delivered'), emoji: '✅', color: '#4CAF50', step: 3 },
    refused:    { label: t('tracking.refused'),   emoji: '❌', color: '#f44336', step: -1 },
  }

  const STEPS = [
    { key: 'pending',    emoji: '⏳', label: t('tracking.stepReceived') },
    { key: 'preparing',  emoji: '👨‍🍳', label: t('tracking.stepPreparing') },
    { key: 'on_the_way', emoji: '🛵', label: t('tracking.stepOnTheWay') },
    { key: 'delivered',  emoji: '✅', label: t('tracking.stepDelivered') },
  ]

  // Pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  useEffect(() => {
    registerForPushNotifications(orderId).then(token => { pushTokenRef.current = token })
  }, [orderId])

  useEffect(() => {
    fetchOrder()
    fetchMessages()

    const orderSub = supabase
      .channel('tracking-' + orderId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        const newOrder = payload.new
        const newStatus = newOrder.status
        const prevStatus = prevStatusRef.current
        setOrder(newOrder)
        if (newStatus !== prevStatus && STATUS_MESSAGES[newStatus]) {
          const msg = STATUS_MESSAGES[newStatus]
          sendLocalNotif({ title: msg.title, body: msg.body, data: { orderId, type: 'status' }, channel: 'order-status' })
        }
        prevStatusRef.current = newStatus
        if (newOrder.driver_lat && newOrder.driver_lng) {
          const loc = { latitude: newOrder.driver_lat, longitude: newOrder.driver_lng }
          setDriverLocation(loc)
          mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000)
        }
      })
      .subscribe()

    chatSubRef.current = supabase
      .channel('chat-client-' + orderId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'order_messages',
        filter: `order_id=eq.${orderId}`,
      }, (payload) => {
        const newMsg = payload.new
        setMessages(prev => [...prev, newMsg])
        if (newMsg.sender === 'restaurant') {
          setChatOpen(prev => {
            if (!prev) {
              setUnreadCount(c => c + 1)
              sendLocalNotif({ title: '💬 Message du restaurant', body: newMsg.message, data: { orderId, type: 'chat' }, channel: 'chat' })
            }
            return prev
          })
        }
        setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(orderSub)
      if (chatSubRef.current) supabase.removeChannel(chatSubRef.current)
    }
  }, [orderId])

  async function fetchOrder() {
    const { data } = await supabase
      .from('orders')
      .select('*, restaurants(name, lat, lng, address)')
      .eq('id', orderId)
      .single()
    if (data) {
      setOrder(data)
      prevStatusRef.current = data.status
      if (data.driver_lat && data.driver_lng) {
        setDriverLocation({ latitude: data.driver_lat, longitude: data.driver_lng })
      }
    }
    setLoading(false)
  }

  async function fetchMessages() {
    const { data } = await supabase
      .from('order_messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  async function sendMessage() {
    const msg = chatInput.trim()
    if (!msg || sendingMsg) return
    setSendingMsg(true)
    setChatInput('')
    Keyboard.dismiss()
    await supabase.from('order_messages').insert({
      order_id: orderId,
      sender: 'client',
      message: msg,
    })
    setSendingMsg(false)
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  function openChat() {
    setChatOpen(true)
    setUnreadCount(0)
    Animated.spring(chatSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 70,
      friction: 12,
    }).start()
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: false }), 200)
  }

  function closeChat() {
    Keyboard.dismiss()
    Animated.timing(chatSlideAnim, {
      toValue: SCREEN_H,
      duration: 260,
      useNativeDriver: true,
    }).start(() => setChatOpen(false))
  }

  function getInitialRegion() {
    if (order?.customer_lat) {
      return { latitude: order.customer_lat, longitude: order.customer_lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }
    }
    return { latitude: 34.271, longitude: 35.744, latitudeDelta: 0.05, longitudeDelta: 0.05 }
  }

  function fitMap() {
    if (!mapRef.current) return
    const coords = []
    if (driverLocation) coords.push(driverLocation)
    if (order?.customer_lat) coords.push({ latitude: order.customer_lat, longitude: order.customer_lng })
    if (order?.restaurants?.lat) coords.push({ latitude: order.restaurants.lat, longitude: order.restaurants.lng })
    if (coords.length > 1) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 60, bottom: 320, left: 60 }, animated: true,
      })
    }
  }

  if (loading || !order) {
    return (
      <View style={s.loadingScreen}>
        <Text style={s.loadingEmoji}>🛵</Text>
        <Text style={s.loadingTxt}>{t('tracking.loading')}</Text>
      </View>
    )
  }

  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const currentStep = status.step
  const isOnTheWay = order.status === 'on_the_way'
  const isDelivered = order.status === 'delivered'
  const showChat = order.status !== 'pending' && order.status !== 'refused'

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ── MAP ── */}
      <MapView
        ref={mapRef}
        style={s.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={DARK_MAP_STYLE}
        initialRegion={getInitialRegion()}
        onMapReady={fitMap}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {order.customer_lat && (
          <Marker coordinate={{ latitude: order.customer_lat, longitude: order.customer_lng }} title={t('tracking.yourAddress')}>
            <View style={s.markerClient}><Text style={s.markerEmoji}>🏠</Text></View>
          </Marker>
        )}
        {order.restaurants?.lat && (
          <Marker coordinate={{ latitude: order.restaurants.lat, longitude: order.restaurants.lng }} title={order.restaurants.name}>
            <View style={s.markerResto}><Text style={s.markerEmoji}>🍽️</Text></View>
          </Marker>
        )}
        {driverLocation && (
          <Marker coordinate={driverLocation} title={order.driver_name || t('tracking.driver')}>
            <View style={s.markerDriverWrap}>
              <Animated.View style={[s.markerDriverPulse, { transform: [{ scale: pulseAnim }] }]} />
              <View style={s.markerDriver}><Text style={s.markerDriverEmoji}>🛵</Text></View>
            </View>
          </Marker>
        )}
        {driverLocation && order.customer_lat && (
          <Polyline
            coordinates={[driverLocation, { latitude: order.customer_lat, longitude: order.customer_lng }]}
            strokeColor={PURPLE} strokeWidth={3} lineDashPattern={[8, 4]}
          />
        )}
      </MapView>

      {/* ── MAP CONTROLS ── */}
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backBtnTxt}>←</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.recenterBtn} onPress={fitMap}>
        <Text style={s.recenterBtnTxt}>⊙</Text>
      </TouchableOpacity>

      {/* ── CHAT FAB ── */}
      {showChat && (
        <TouchableOpacity style={s.chatFab} onPress={openChat} activeOpacity={0.85}>
          <Text style={s.chatFabEmoji}>💬</Text>
          {unreadCount > 0 && (
            <View style={s.chatFabBadge}>
              <Text style={s.chatFabBadgeTxt}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* ── BOTTOM SHEET ── */}
      <View style={s.sheet}>
        <View style={s.sheetHandle} />

        {/* Status banner */}
        <View style={[s.statusBanner, { backgroundColor: status.color + '15', borderColor: status.color + '35' }]}>
          <Text style={s.statusEmoji}>{status.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.statusLabel, { color: status.color }]}>{status.label}</Text>
            <Text style={s.statusSub} numberOfLines={2}>
              {order.status === 'pending'    && t('tracking.pendingSub')}
              {order.status === 'preparing'  && t('tracking.preparingSub')}
              {order.status === 'on_the_way' && `${order.driver_name || t('tracking.onTheWayDefault')} ${t('tracking.onTheWaySub')}`}
              {order.status === 'delivered'  && t('tracking.deliveredSub')}
              {order.status === 'refused'    && (order.refusal_reason || t('tracking.refusedSub'))}
            </Text>
          </View>
          {/* Live chip */}
          {isOnTheWay && driverLocation && (
            <View style={s.liveChip}>
              <Animated.View style={[s.liveDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={s.liveTxt}>LIVE</Text>
            </View>
          )}
        </View>

        {/* Progress steps */}
        {order.status !== 'refused' && (
          <View style={s.stepsRow}>
            {STEPS.map((step, i) => {
              const done = i <= currentStep
              const active = i === currentStep
              return (
                <View key={step.key} style={s.stepWrap}>
                  {i < STEPS.length - 1 && (
                    <View style={[s.stepLine, { backgroundColor: done && i < currentStep ? status.color : BORDER2 }]} />
                  )}
                  <View style={[
                    s.stepCircle,
                    done && { backgroundColor: status.color + '20', borderColor: status.color },
                    active && { borderWidth: 2 },
                  ]}>
                    <Text style={[s.stepEmoji, !done && { opacity: 0.3 }]}>{step.emoji}</Text>
                  </View>
                  <Text style={[s.stepLabel, { color: done ? status.color : GRAY2 }]}>{step.label}</Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Driver card */}
        {order.driver_name && !isDelivered && (
          <View style={s.driverCard}>
            <View style={s.driverAvatar}>
              <Text style={s.driverAvatarTxt}>{order.driver_name[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.driverLbl}>{t('tracking.yourDriver')}</Text>
              <Text style={s.driverName}>{order.driver_name}</Text>
            </View>
            {showChat && (
              <TouchableOpacity style={s.driverChatBtn} onPress={openChat}>
                <Text style={s.driverChatEmoji}>💬</Text>
                {unreadCount > 0 && <View style={s.driverChatBadge}><Text style={s.driverChatBadgeTxt}>{unreadCount}</Text></View>}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Info row */}
        <View style={s.infoRow}>
          <View style={s.infoBox}>
            <Text style={s.infoLbl}>{t('tracking.restaurant')}</Text>
            <Text style={s.infoVal} numberOfLines={1}>{order.restaurants?.name}</Text>
          </View>
          <View style={[s.infoBox, s.infoBoxMid]}>
            <Text style={s.infoLbl}>{t('tracking.total')}</Text>
            <Text style={[s.infoVal, { color: ORANGE }]}>${order.total}</Text>
          </View>
          <View style={s.infoBox}>
            <Text style={s.infoLbl}>{t('tracking.payment')}</Text>
            <Text style={s.infoVal}>{order.payment_method === 'whish' ? '📱 Whish' : '💵 Cash'}</Text>
          </View>
        </View>

        {/* Address */}
        <View style={s.addrRow}>
          <Text style={s.addrPin}>📍</Text>
          <Text style={s.addrTxt} numberOfLines={2}>{order.customer_address}</Text>
        </View>
      </View>

      {/* ── CHAT MODAL (full screen slide) ── */}
      <Modal visible={chatOpen} transparent animationType="none" onRequestClose={closeChat}>
        <View style={s.chatOverlay}>
          <TouchableOpacity style={s.chatBackdrop} activeOpacity={1} onPress={closeChat} />
          <Animated.View style={[s.chatSheet, { transform: [{ translateY: chatSlideAnim }] }]}>

            {/* Chat header */}
            <View style={s.chatHeader}>
              <View style={s.chatHeaderLeft}>
                <View style={s.chatAvatar}>
                  <Text style={s.chatAvatarTxt}>{order.restaurants?.name?.[0]?.toUpperCase() || '🍽'}</Text>
                </View>
                <View>
                  <Text style={s.chatTitle}>{order.restaurants?.name || 'Restaurant'}</Text>
                  <View style={s.chatOnlineRow}>
                    <View style={s.chatOnlineDot} />
                    <Text style={s.chatOnlineTxt}>En ligne</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={s.chatCloseBtn} onPress={closeChat}>
                <Text style={s.chatCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <ScrollView
              ref={chatScrollRef}
              style={s.chatMsgs}
              contentContainerStyle={s.chatMsgsContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: false })}
            >
              {messages.length === 0 ? (
                <View style={s.chatEmpty}>
                  <Text style={s.chatEmptyEmoji}>💬</Text>
                  <Text style={s.chatEmptyTxt}>Pas encore de messages</Text>
                  <Text style={s.chatEmptySubTxt}>Pose une question au restaurant sur ta commande</Text>
                </View>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.sender === 'client'
                  const time = new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[i-1].created_at).toDateString()
                  return (
                    <View key={msg.id || i}>
                      {showDate && (
                        <View style={s.dateSep}>
                          <View style={s.dateLine} />
                          <Text style={s.dateTxt}>{new Date(msg.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</Text>
                          <View style={s.dateLine} />
                        </View>
                      )}
                      <View style={[s.msgRow, isMe ? s.msgRowMe : s.msgRowThem]}>
                        {!isMe && (
                          <View style={s.msgAvatar}>
                            <Text style={s.msgAvatarTxt}>{order.restaurants?.name?.[0]?.toUpperCase() || '🍽'}</Text>
                          </View>
                        )}
                        <View style={[s.msgBubble, isMe ? s.msgBubbleMe : s.msgBubbleThem]}>
                          <Text style={[s.msgTxt, isMe ? s.msgTxtMe : s.msgTxtThem]}>{msg.message}</Text>
                          <Text style={[s.msgTime, isMe ? s.msgTimeMe : s.msgTimeThem]}>{time}</Text>
                        </View>
                      </View>
                    </View>
                  )
                })
              )}
            </ScrollView>

            {/* Input */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={s.chatInputWrap}>
                <TextInput
                  style={s.chatInput}
                  placeholder="Message..."
                  placeholderTextColor={GRAY2}
                  value={chatInput}
                  onChangeText={setChatInput}
                  onSubmitEditing={sendMessage}
                  returnKeyType="send"
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[s.chatSendBtn, (!chatInput.trim() || sendingMsg) && s.chatSendBtnOff]}
                  onPress={sendMessage}
                  disabled={!chatInput.trim() || sendingMsg}
                >
                  <Text style={s.chatSendIcon}>➤</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>

          </Animated.View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Loading
  loadingScreen: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingEmoji:  { fontSize: 36 },
  loadingTxt:    { color: GRAY, fontSize: 15 },

  // Map
  map: { flex: 1 },

  // Map controls
  backBtn:      { position: 'absolute', top: 60, left: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: '#141414', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BORDER2 },
  backBtnTxt:   { color: WHITE, fontSize: 18, fontWeight: '700' },
  recenterBtn:  { position: 'absolute', top: 110, left: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: '#141414', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BORDER2 },
  recenterBtnTxt: { color: WHITE, fontSize: 20 },

  // Chat FAB
  chatFab:       { position: 'absolute', top: 110, right: 18, width: 50, height: 50, borderRadius: 25, backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center', shadowColor: ORANGE, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  chatFabEmoji:  { fontSize: 22 },
  chatFabBadge:  { position: 'absolute', top: -3, right: -3, backgroundColor: WHITE, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  chatFabBadgeTxt: { color: ORANGE, fontSize: 10, fontWeight: '800' },

  // Markers
  markerClient:      { backgroundColor: ORANGE, borderRadius: 22, padding: 9, borderWidth: 2.5, borderColor: WHITE },
  markerResto:       { backgroundColor: '#2196F3', borderRadius: 22, padding: 9, borderWidth: 2.5, borderColor: WHITE },
  markerEmoji:       { fontSize: 18 },
  markerDriverWrap:  { alignItems: 'center', justifyContent: 'center' },
  markerDriverPulse: { position: 'absolute', width: 54, height: 54, borderRadius: 27, backgroundColor: PURPLE + '33' },
  markerDriver:      { backgroundColor: PURPLE, borderRadius: 26, padding: 10, borderWidth: 3, borderColor: WHITE },
  markerDriverEmoji: { fontSize: 20 },

  // Bottom sheet
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    // Fixed height — no chat inside anymore
  },
  sheetHandle: { width: 38, height: 4, backgroundColor: BORDER2, borderRadius: 2, alignSelf: 'center', marginVertical: 14 },

  // Status banner
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  statusEmoji:  { fontSize: 26 },
  statusLabel:  { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  statusSub:    { color: GRAY, fontSize: 12, lineHeight: 17 },
  liveChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: PURPLE + '22', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: PURPLE + '44' },
  liveDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: PURPLE },
  liveTxt:      { color: '#CE93D8', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },

  // Steps
  stepsRow:   { flexDirection: 'row', marginBottom: 14 },
  stepWrap:   { flex: 1, alignItems: 'center', position: 'relative' },
  stepLine:   { position: 'absolute', top: 17, left: '50%', right: '-50%', height: 2, zIndex: -1 },
  stepCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: BORDER2, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  stepEmoji:  { fontSize: 13 },
  stepLabel:  { fontSize: 9, textAlign: 'center', fontWeight: '600', letterSpacing: 0.3 },

  // Driver card
  driverCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1a1a1a', borderRadius: 14, padding: 13, marginBottom: 12, borderWidth: 1, borderColor: BORDER2 },
  driverAvatar:     { width: 42, height: 42, borderRadius: 21, backgroundColor: PURPLE + '22', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: PURPLE + '44' },
  driverAvatarTxt:  { color: '#CE93D8', fontWeight: '700', fontSize: 17 },
  driverLbl:        { color: GRAY2, fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  driverName:       { color: WHITE, fontWeight: '700', fontSize: 15 },
  driverChatBtn:    { width: 42, height: 42, borderRadius: 21, backgroundColor: ORANGE + '18', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: ORANGE + '35' },
  driverChatEmoji:  { fontSize: 18 },
  driverChatBadge:  { position: 'absolute', top: -2, right: -2, backgroundColor: ORANGE, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
  driverChatBadgeTxt: { color: WHITE, fontSize: 9, fontWeight: '800' },

  // Info row
  infoRow:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  infoBox:    { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 11, borderWidth: 1, borderColor: BORDER },
  infoBoxMid: { borderColor: ORANGE + '30', backgroundColor: ORANGE + '08' },
  infoLbl:    { color: GRAY2, fontSize: 9, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  infoVal:    { color: WHITE, fontWeight: '700', fontSize: 13 },

  // Address
  addrRow:  { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  addrPin:  { fontSize: 14, marginTop: 1 },
  addrTxt:  { flex: 1, color: GRAY, fontSize: 13, lineHeight: 19 },

  // ── CHAT MODAL ──
  chatOverlay:  { flex: 1, justifyContent: 'flex-end' },
  chatBackdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  chatSheet: {
    height: SCREEN_H * 0.88,
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: BORDER2,
    overflow: 'hidden',
  },

  // Chat header
  chatHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: '#141414' },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chatAvatar:     { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2196F322', borderWidth: 1, borderColor: '#2196F344', justifyContent: 'center', alignItems: 'center' },
  chatAvatarTxt:  { color: '#7AB8F0', fontWeight: '700', fontSize: 17 },
  chatTitle:      { color: WHITE, fontWeight: '700', fontSize: 15 },
  chatOnlineRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  chatOnlineDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
  chatOnlineTxt:  { color: '#4CAF50', fontSize: 11, fontWeight: '600' },
  chatCloseBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BORDER2 },
  chatCloseTxt:   { color: GRAY, fontSize: 14 },

  // Messages area
  chatMsgs:        { flex: 1, backgroundColor: BG },
  chatMsgsContent: { paddingHorizontal: 16, paddingVertical: 16, gap: 4 },

  // Empty state
  chatEmpty:       { alignItems: 'center', paddingVertical: 60, gap: 10 },
  chatEmptyEmoji:  { fontSize: 40 },
  chatEmptyTxt:    { color: GRAY, fontSize: 16, fontWeight: '600' },
  chatEmptySubTxt: { color: GRAY2, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 },

  // Date separator
  dateSep:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  dateLine: { flex: 1, height: 1, backgroundColor: BORDER },
  dateTxt:  { color: GRAY2, fontSize: 11, fontWeight: '500' },

  // Message rows
  msgRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 3 },
  msgRowMe:     { justifyContent: 'flex-end' },
  msgRowThem:   { justifyContent: 'flex-start' },
  msgAvatar:    { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2196F322', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2196F333', marginBottom: 2 },
  msgAvatarTxt: { color: '#7AB8F0', fontSize: 12, fontWeight: '700' },
  msgBubble:    { maxWidth: SCREEN_W * 0.72, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  msgBubbleMe:  { backgroundColor: ORANGE, borderBottomRightRadius: 4 },
  msgBubbleThem:{ backgroundColor: '#1e1e1e', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: BORDER2 },
  msgTxt:       { fontSize: 14, lineHeight: 20 },
  msgTxtMe:     { color: WHITE },
  msgTxtThem:   { color: '#d8d8d8' },
  msgTime:      { fontSize: 10 },
  msgTimeMe:    { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  msgTimeThem:  { color: GRAY2 },

  // Chat input
  chatInputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: '#141414',
  },
  chatInput:       { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, paddingTop: 11, color: WHITE, fontSize: 14, borderWidth: 1, borderColor: BORDER2, maxHeight: 120 },
  chatSendBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center', shadowColor: ORANGE, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 },
  chatSendBtnOff:  { backgroundColor: '#1a1a1a', shadowOpacity: 0, elevation: 0 },
  chatSendIcon:    { color: WHITE, fontSize: 16 },
})

