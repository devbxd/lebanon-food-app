import { useEffect, useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, Keyboard
} from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { useTranslation } from '../lib/LanguageContext'

const { height: SCREEN_H } = Dimensions.get('window')

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

  const mapRef = useRef(null)
  const pulseAnim = useRef(new Animated.Value(1)).current

  const STATUS_CONFIG = {
    pending:    { label: t('tracking.pending'),    emoji: '⏳', color: '#FF9800', step: 0 },
    preparing:  { label: t('tracking.preparing'),  emoji: '👨‍🍳', color: '#2196F3', step: 1 },
    on_the_way: { label: t('tracking.onTheWay'),   emoji: '🛵', color: '#9C27B0', step: 2 },
    delivered:  { label: t('tracking.delivered'),  emoji: '✅', color: '#4CAF50', step: 3 },
    refused:    { label: t('tracking.refused'),    emoji: '❌', color: '#f44336', step: -1 },
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
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  useEffect(() => {
    fetchOrder()
    fetchMessages()

    // Realtime commande
    const orderSub = supabase
      .channel('tracking-' + orderId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `id=eq.${orderId}`
      }, (payload) => {
        setOrder(payload.new)
        if (payload.new.driver_lat && payload.new.driver_lng) {
          const loc = { latitude: payload.new.driver_lat, longitude: payload.new.driver_lng }
          setDriverLocation(loc)
          mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000)
        }
      })
      .subscribe()

    // Realtime chat
    chatSubRef.current = supabase
      .channel('chat-client-' + orderId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'order_messages',
        filter: `order_id=eq.${orderId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
        // Si message du resto et chat fermé → incrémenter badge
        if (payload.new.sender === 'restaurant') {
          setChatOpen(prev => {
            if (!prev) setUnreadCount(c => c + 1)
            return prev
          })
        }
        // Scroll bas
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
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: false }), 150)
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
        edgePadding: { top: 80, right: 60, bottom: 340, left: 60 }, animated: true
      })
    }
  }

  if (loading || !order) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingTxt}>{t('tracking.loading')}</Text>
      </View>
    )
  }

  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const currentStep = status.step
  const isOnTheWay = order.status === 'on_the_way'
  const isDelivered = order.status === 'delivered'
  const showChat = order.status !== 'pending' && order.status !== 'refused'

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* CARTE */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={DARK_MAP_STYLE}
        initialRegion={getInitialRegion()}
        onMapReady={fitMap}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {order.customer_lat && (
          <Marker coordinate={{ latitude: order.customer_lat, longitude: order.customer_lng }} title={t('tracking.yourAddress')}>
            <View style={styles.markerClient}><Text style={styles.markerEmoji}>🏠</Text></View>
          </Marker>
        )}
        {order.restaurants?.lat && (
          <Marker coordinate={{ latitude: order.restaurants.lat, longitude: order.restaurants.lng }} title={order.restaurants.name}>
            <View style={styles.markerResto}><Text style={styles.markerEmoji}>🍽️</Text></View>
          </Marker>
        )}
        {driverLocation && (
          <Marker coordinate={driverLocation} title={order.driver_name || t('tracking.driver')}>
            <View style={styles.markerDriverWrapper}>
              <Animated.View style={[styles.markerDriverPulse, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.markerDriver}><Text style={styles.markerDriverEmoji}>🛵</Text></View>
            </View>
          </Marker>
        )}
        {driverLocation && order.customer_lat && (
          <Polyline
            coordinates={[driverLocation, { latitude: order.customer_lat, longitude: order.customer_lng }]}
            strokeColor="#9C27B0" strokeWidth={3} lineDashPattern={[8, 4]}
          />
        )}
      </MapView>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnTxt}>←</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.recenterBtn} onPress={fitMap}>
        <Text style={styles.recenterBtnTxt}>⊙</Text>
      </TouchableOpacity>

      {/* Chat bubble button (quand chat fermé) */}
      {showChat && !chatOpen && (
        <TouchableOpacity style={styles.chatFab} onPress={openChat} activeOpacity={0.85}>
          <Text style={styles.chatFabEmoji}>💬</Text>
          {unreadCount > 0 && (
            <View style={styles.chatFabBadge}>
              <Text style={styles.chatFabBadgeTxt}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* BOTTOM SHEET */}
      <View
        style={[
          styles.sheet,
          {
            height: chatOpen
              ? SCREEN_H * 0.75
              : SCREEN_H * 0.42,
          },
        ]}
      >
        <View style={styles.sheetHandle} />

        {showChat && chatOpen ? (
          /* Chat ouvert */
          <View style={styles.chatContainer}>
            {/* Chat header */}
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderLeft}>
                <View style={styles.chatHeaderAvatar}>
                  <Text style={styles.chatHeaderAvatarTxt}>
                    {order.restaurants?.name?.[0]?.toUpperCase() || '🍽️'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.chatHeaderTitle}>{order.restaurants?.name || 'Restaurant'}</Text>
                  <Text style={styles.chatHeaderSubtitle}>Discussion sur votre commande</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setChatOpen(false)} style={styles.chatCloseBtn}>
                <Text style={styles.chatCloseTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <ScrollView
              ref={chatScrollRef}
              style={styles.chatMessages}
              contentContainerStyle={styles.chatMessagesContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: false })}
            >
              {messages.length === 0 ? (
                <View style={styles.chatEmptyBox}>
                  <View style={styles.chatEmptyIconCircle}>
                    <Text style={styles.chatEmptyEmoji}>💬</Text>
                  </View>
                  <Text style={styles.chatEmptyText}>Aucun message</Text>
                  <Text style={styles.chatEmptySubText}>Posez une question au restaurant à propos de votre commande</Text>
                </View>
              ) : (
                messages.map((msg, i) => {
                  const isClient = msg.sender === 'client'
                  const time = new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <View key={msg.id || i} style={[styles.msgRow, isClient ? styles.msgRowClient : styles.msgRowResto]}>
                      <View style={[styles.msgBubble, isClient ? styles.msgBubbleClient : styles.msgBubbleResto]}>
                        <Text style={[styles.msgText, isClient ? styles.msgTextClient : styles.msgTextResto]}>
                          {msg.message}
                        </Text>
                      </View>
                      <Text style={[styles.msgTime, isClient ? styles.msgTimeClient : styles.msgTimeResto]}>
                        {time}
                      </Text>
                    </View>
                  )
                })
              )}
            </ScrollView>

            {/* Input */}
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="Écrire un message..."
                placeholderTextColor="#5a5a5a"
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
                multiline={false}
              />
              <TouchableOpacity
                style={[styles.chatSendBtn, (!chatInput.trim() || sendingMsg) && styles.chatSendBtnDisabled]}
                onPress={sendMessage}
                disabled={!chatInput.trim() || sendingMsg}
              >
                <Text style={styles.chatSendEmoji}>➤</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Bottom sheet normal */
          <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={false}>
            {/* Status banner */}
            <View style={[styles.statusBanner, { backgroundColor: status.color + '18', borderColor: status.color + '44' }]}>
              <Text style={styles.statusBannerEmoji}>{status.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusBannerLabel, { color: status.color }]}>{status.label}</Text>
                <Text style={styles.statusBannerSub}>
                  {order.status === 'pending' && t('tracking.pendingSub')}
                  {order.status === 'preparing' && t('tracking.preparingSub')}
                  {order.status === 'on_the_way' && `${order.driver_name || t('tracking.onTheWayDefault')} ${t('tracking.onTheWaySub')}`}
                  {order.status === 'delivered' && t('tracking.deliveredSub')}
                  {order.status === 'refused' && (order.refusal_reason || t('tracking.refusedSub'))}
                </Text>
              </View>
            </View>

            {/* Progress steps */}
            {order.status !== 'refused' && (
              <View style={styles.stepsRow}>
                {STEPS.map((step, i) => {
                  const done = i <= currentStep
                  const isCurrent = i === currentStep
                  return (
                    <View key={step.key} style={styles.stepWrapper}>
                      {i < STEPS.length - 1 && (
                        <View style={[styles.stepLine, done && i < currentStep && { backgroundColor: status.color }]} />
                      )}
                      <View style={[styles.stepCircle, done && { backgroundColor: status.color + '22', borderColor: status.color }, isCurrent && { borderWidth: 2 }]}>
                        <Text style={styles.stepEmoji}>{step.emoji}</Text>
                      </View>
                      <Text style={[styles.stepLabel, done && { color: status.color }]}>{step.label}</Text>
                    </View>
                  )
                })}
              </View>
            )}

            {/* Livreur */}
            {order.driver_name && !isDelivered && (
              <View style={styles.driverCard}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarTxt}>{order.driver_name[0]?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverLabel}>{t('tracking.yourDriver')}</Text>
                  <Text style={styles.driverName}>{order.driver_name}</Text>
                </View>
                {isOnTheWay && driverLocation && (
                  <View style={[styles.liveChip, { backgroundColor: '#9C27B022', borderColor: '#9C27B044' }]}>
                    <View style={[styles.liveDot, { backgroundColor: '#9C27B0' }]} />
                    <Text style={[styles.liveChipTxt, { color: '#CE93D8' }]}>{t('tracking.gpsLive')}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Infos */}
            <View style={styles.infoRow}>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>{t('tracking.restaurant')}</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{order.restaurants?.name}</Text>
              </View>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>{t('tracking.total')}</Text>
                <Text style={[styles.infoValue, { color: '#FF6B35' }]}>${order.total}</Text>
              </View>
              <View style={styles.infoBox}>
                <Text style={styles.infoLabel}>{t('tracking.payment')}</Text>
                <Text style={styles.infoValue}>{order.payment_method === 'whish' ? t('tracking.whishLabel') : t('tracking.cash')}</Text>
              </View>
            </View>

            {/* Adresse */}
            <View style={styles.addrRow}>
              <Text style={styles.addrEmoji}>📍</Text>
              <Text style={styles.addrTxt} numberOfLines={2}>{order.customer_address}</Text>
            </View>

            {/* Bouton ouvrir chat */}
            {showChat && (
              <TouchableOpacity style={styles.openChatBtn} onPress={openChat} activeOpacity={0.82}>
                <Text style={styles.openChatBtnText}>
                  💬 Contacter le restaurant
                  {unreadCount > 0 ? `  •  ${unreadCount} nouveau${unreadCount > 1 ? 'x' : ''}` : ''}
                </Text>
                {unreadCount > 0 && <View style={styles.openChatBadge}><Text style={styles.openChatBadgeTxt}>{unreadCount}</Text></View>}
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  loadingScreen: { flex: 1, backgroundColor: '#0d0d0d', justifyContent: 'center', alignItems: 'center' },
  loadingTxt: { color: '#555', fontSize: 16 },
  map: { flex: 1 },

  backBtn: { position: 'absolute', top: 60, left: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: '#141414', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  backBtnTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
  recenterBtn: { position: 'absolute', top: 110, left: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: '#141414', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  recenterBtnTxt: { color: '#fff', fontSize: 20 },

  // Chat FAB (bouton flottant)
  chatFab: { position: 'absolute', top: 110, right: 20, width: 48, height: 48, borderRadius: 24, backgroundColor: '#1a2e1a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a4a2a' },
  chatFabEmoji: { fontSize: 22 },
  chatFabBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#FF6B35', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  chatFabBadgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },

  markerClient: { backgroundColor: '#FF6B35', borderRadius: 20, padding: 8, borderWidth: 2, borderColor: '#fff' },
  markerResto: { backgroundColor: '#2196F3', borderRadius: 20, padding: 8, borderWidth: 2, borderColor: '#fff' },
  markerEmoji: { fontSize: 18 },
  markerDriverWrapper: { alignItems: 'center', justifyContent: 'center' },
  markerDriverPulse: { position: 'absolute', width: 50, height: 50, borderRadius: 25, backgroundColor: '#9C27B033' },
  markerDriver: { backgroundColor: '#9C27B0', borderRadius: 24, padding: 10, borderWidth: 3, borderColor: '#fff' },
  markerDriverEmoji: { fontSize: 20 },

  // Bottom sheet
  sheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 0,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    height: SCREEN_H * 0.78,
  },

  sheetHandle: { width: 36, height: 4, backgroundColor: '#2a2a2a', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },

  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 14 },
  statusBannerEmoji: { fontSize: 28 },
  statusBannerLabel: { fontWeight: '700', fontSize: 15, marginBottom: 2 },
  statusBannerSub: { color: '#888', fontSize: 13, lineHeight: 18 },

  stepsRow: { flexDirection: 'row', marginBottom: 14, position: 'relative' },
  stepWrapper: { flex: 1, alignItems: 'center', position: 'relative' },
  stepLine: { position: 'absolute', top: 18, left: '50%', right: '-50%', height: 2, backgroundColor: '#1f1f1f', zIndex: -1 },
  stepCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1f1f1f', borderWidth: 1, borderColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  stepEmoji: { fontSize: 14 },
  stepLabel: { color: '#444', fontSize: 10, textAlign: 'center' },

  driverCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1a1a1a', borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#9C27B022', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#9C27B044' },
  driverAvatarTxt: { color: '#CE93D8', fontWeight: '700', fontSize: 18 },
  driverLabel: { color: '#555', fontSize: 11 },
  driverName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveChipTxt: { fontSize: 12, fontWeight: '600' },

  infoRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  infoBox: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#2a2a2a' },
  infoLabel: { color: '#555', fontSize: 10, marginBottom: 3 },
  infoValue: { color: '#fff', fontWeight: '600', fontSize: 13 },

  addrRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 12 },
  addrEmoji: { fontSize: 14, marginTop: 1 },
  addrTxt: { flex: 1, color: '#666', fontSize: 13, lineHeight: 18 },

  // Bouton ouvrir chat
  openChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0e1a0e',
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: '#2a4a2a',
    marginBottom: 20,
  },
  openChatBtnText: { color: '#4a9a6a', fontWeight: '600', fontSize: 14 },
  openChatBadge: { backgroundColor: '#FF6B35', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  openChatBadgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Chat container (remplace le bottom sheet quand ouvert)
  chatContainer: { flex: 1 },

  chatHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 14, marginBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#222',
  },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatHeaderAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#2196F322', borderWidth: 1, borderColor: '#2196F344',
    justifyContent: 'center', alignItems: 'center',
  },
  chatHeaderAvatarTxt: { color: '#7AB8F0', fontWeight: '700', fontSize: 16 },
  chatHeaderTitle: { color: '#f0f0ec', fontWeight: '700', fontSize: 15 },
  chatHeaderSubtitle: { color: '#5a5a5a', fontSize: 11, marginTop: 1 },
  chatCloseBtn: {
    backgroundColor: '#1a1a1a', borderRadius: 16, width: 32, height: 32,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a',
  },
  chatCloseTxt: { color: '#888', fontSize: 14 },

  chatMessages: { flex: 1, marginBottom: 10 },
  chatMessagesContent: { paddingVertical: 6, gap: 10 },

  chatEmptyBox: { alignItems: 'center', paddingVertical: 40 },
  chatEmptyIconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  chatEmptyEmoji: { fontSize: 24 },
  chatEmptyText: { color: '#999', fontSize: 15, fontWeight: '600' },
  chatEmptySubText: { color: '#444', fontSize: 12, marginTop: 4, textAlign: 'center', paddingHorizontal: 40, lineHeight: 17 },

  msgRow: { flexDirection: 'column', gap: 4, maxWidth: '100%' },
  msgRowClient: { alignItems: 'flex-end' },
  msgRowResto: { alignItems: 'flex-start' },
  msgBubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  msgBubbleClient: { backgroundColor: '#FF6B35', borderBottomRightRadius: 4 },
  msgBubbleResto: { backgroundColor: '#1e1e22', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#2a2a2e' },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextClient: { color: '#fff' },
  msgTextResto: { color: '#d4d4d8' },
  msgTime: { fontSize: 10, color: '#444', marginHorizontal: 4 },
  msgTimeClient: { textAlign: 'right' },
  msgTimeResto: { textAlign: 'left' },

  chatInputRow: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#222',
  },
  chatInput: {
    flex: 1, backgroundColor: '#1a1a1a', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 11, color: '#e8e8e4', fontSize: 14,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  chatSendBtn: {
    backgroundColor: '#FF6B35', borderRadius: 21, width: 42, height: 42,
    justifyContent: 'center', alignItems: 'center',
  },
  chatSendBtnDisabled: { backgroundColor: '#1a1a1a', opacity: 0.6 },
  chatSendEmoji: { color: '#fff', fontSize: 16 },
})