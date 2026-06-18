import * as Location from 'expo-location'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Animated, Dimensions,
  Linking,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useTranslation } from '../lib/LanguageContext'
import { supabase } from '../lib/supabase'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

export default function DriverScreen() {
  const { t } = useTranslation()
  const { driverId, driverName } = useLocalSearchParams()
  const [orders, setOrders] = useState([])
  const [myOrders, setMyOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [gpsActive, setGpsActive] = useState(false)
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const locationSubRef = useRef(null)
  const activeOrderIdRef = useRef(null)
  const router = useRouter()

  const isBusy = myOrders.length > 0

  useEffect(() => {
    // Pulse animation for active delivery dot
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [])

  useEffect(() => {
    fetchOrders()
    const sub = supabase
      .channel('driver-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe()
    return () => {
      supabase.removeChannel(sub)
      stopGPS()
    }
  }, [])

  async function startGPS(orderId) {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('driver.gpsPermissionTitle'), t('driver.gpsPermissionMsg'))
      return
    }
    activeOrderIdRef.current = orderId
    setGpsActive(true)
    locationSubRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
      async (loc) => {
        await supabase.from('orders').update({
          driver_lat: loc.coords.latitude,
          driver_lng: loc.coords.longitude,
        }).eq('id', activeOrderIdRef.current)
      }
    )
  }

  async function stopGPS() {
    if (locationSubRef.current) {
      locationSubRef.current.remove()
      locationSubRef.current = null
    }
    if (activeOrderIdRef.current) {
      await supabase.from('orders').update({ driver_lat: null, driver_lng: null })
        .eq('id', activeOrderIdRef.current)
      activeOrderIdRef.current = null
    }
    setGpsActive(false)
  }

  async function fetchOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*, restaurants(name, lat, lng, address)')
      .order('created_at', { ascending: false })
    if (data) {
      setOrders(data.filter(o => o.status === 'preparing' && !o.driver_id))
      setMyOrders(data.filter(o => o.driver_id === driverId && o.status !== 'delivered'))
    }
    setLoading(false)
  }

  function openMaps(lat, lng) {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    Linking.openURL(url).catch(() => Alert.alert(t('driver.error'), t('driver.mapsError')))
  }

  function openWhatsApp(phone) {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '')
    const number = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned
    const url = `https://wa.me/${number}`
    Linking.openURL(url).catch(() =>
      Alert.alert('WhatsApp', 'Impossible d\'ouvrir WhatsApp. Vérifiez que l\'app est installée.')
    )
  }

  function openOrderDetail(order) {
    setSelectedOrder(order)
    setModalVisible(true)
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start()
  }

  function closeModal() {
    Animated.timing(slideAnim, {
      toValue: SCREEN_H,
      duration: 280,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false)
      setSelectedOrder(null)
    })
  }

  async function acceptOrder(orderId) {
    if (isBusy) {
      Alert.alert(t('driver.alreadyBusy'), t('driver.alreadyBusyMsg'))
      return
    }
    const { error } = await supabase.from('orders').update({
      driver_id: driverId,
      driver_name: driverName,
    }).eq('id', orderId)
    if (error) {
      Alert.alert(t('driver.error'), error.message)
    } else {
      closeModal()
      fetchOrders()
    }
  }

  async function pickupOrder(orderId) {
    await supabase.from('orders').update({ status: 'on_the_way' }).eq('id', orderId)
    fetchOrders()
    await startGPS(orderId)
  }

  async function completeOrder(orderId) {
    Alert.alert(t('driver.confirmDeliveryTitle'), t('driver.confirmDeliveryMsg'), [
      { text: t('driver.cancel'), style: 'cancel' },
      {
        text: t('driver.confirm'), style: 'default', onPress: async () => {
          await supabase.from('orders').update({ status: 'delivered' }).eq('id', orderId)
          await stopGPS()
          fetchOrders()
        }
      }
    ])
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{driverName?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerGreet}>{t('driver.greeting')}</Text>
            <Text style={styles.headerName}>{driverName}</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace('/login')}>
            <Text style={styles.logoutTxt}>{t('driver.quit')}</Text>
          </TouchableOpacity>
        </View>

        {/* Status pill */}
        <View style={[styles.statusPill, isBusy ? styles.statusPillBusy : styles.statusPillFree]}>
          <Animated.View style={[styles.statusDot, {
            backgroundColor: isBusy ? '#FF6D00' : '#00C853',
            transform: [{ scale: pulseAnim }],
          }]} />
          <Text style={[styles.statusPillTxt, { color: isBusy ? '#FF6D00' : '#00C853' }]}>
            {isBusy
              ? t('driver.busy')
              : `${orders.length} ${orders.length !== 1 ? t('driver.availablePlural') : t('driver.available')} ${orders.length !== 1 ? t('driver.availableSuffixPlural') : t('driver.availableSuffix')}`}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Active delivery */}
        {myOrders.map(order => (
          <View key={order.id} style={styles.activeCard}>
            {/* Top accent bar */}
            <View style={[styles.activeAccentBar, order.status === 'on_the_way' && styles.activeAccentBarGreen]} />

            <View style={styles.activeCardInner}>
              {/* Status row */}
              <View style={styles.activeStatusRow}>
                <View style={[styles.activeStatusBadge, order.status === 'on_the_way' && styles.activeStatusBadgeGreen]}>
                  <Text style={styles.activeStatusEmoji}>
                    {order.status === 'preparing' ? '🏪' : '🛵'}
                  </Text>
                  <Text style={[styles.activeStatusTxt, order.status === 'on_the_way' && { color: '#00C853' }]}>
                    {order.status === 'preparing' ? t('driver.preparingLabel') : t('driver.onTheWayToClient')}
                  </Text>
                </View>
                <View style={styles.activeRight}>
                  {gpsActive && (
                    <View style={styles.gpsBadge}>
                      <View style={styles.gpsDot} />
                      <Text style={styles.gpsBadgeTxt}>GPS</Text>
                    </View>
                  )}
                  <Text style={styles.activeTotal}>${order.total}</Text>
                </View>
              </View>

              {/* Restaurant */}
              <Text style={styles.activeResto}>{order.restaurants?.name}</Text>

              <View style={styles.separator} />

              {/* Client block */}
              <View style={styles.clientBlock}>
                <View style={styles.clientAvatar}>
                  <Text style={styles.clientAvatarTxt}>{order.customer_name?.[0]?.toUpperCase()}</Text>
                </View>
                <View style={styles.clientMeta}>
                  <Text style={styles.clientName}>{order.customer_name}</Text>
                  <Text style={styles.clientPhone}>{order.customer_phone}</Text>
                </View>
                <View style={styles.contactButtons}>
                  <TouchableOpacity
                    style={styles.contactBtn}
                    onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}
                  >
                    <Text style={styles.contactBtnTxt}>📞</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.contactBtn, styles.contactBtnWa]}
                    onPress={() => openWhatsApp(order.customer_phone)}
                  >
                    <Text style={styles.contactBtnTxt}>💬</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Address */}
              <View style={styles.addrBlock}>
                <Text style={styles.addrPin}>📍</Text>
                <Text style={styles.addrTxt}>{order.customer_address}</Text>
              </View>

              {/* Map buttons */}
              <View style={styles.mapsRow}>
                {order.restaurants?.lat && (
                  <TouchableOpacity
                    style={styles.mapBtn}
                    onPress={() => openMaps(order.restaurants.lat, order.restaurants.lng)}
                  >
                    <Text style={styles.mapBtnLabel}>🏪 {t('driver.toRestaurant')}</Text>
                  </TouchableOpacity>
                )}
                {order.customer_lat && (
                  <TouchableOpacity
                    style={[styles.mapBtn, styles.mapBtnClient]}
                    onPress={() => openMaps(order.customer_lat, order.customer_lng)}
                  >
                    <Text style={[styles.mapBtnLabel, { color: '#64B5F6' }]}>🏠 {t('driver.toClient')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Action button */}
              {order.status === 'preparing' ? (
                <TouchableOpacity style={styles.actionBtnOrange} onPress={() => pickupOrder(order.id)}>
                  <Text style={styles.actionBtnTxt}>✓ {t('driver.pickedUp')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.actionBtnGreen} onPress={() => completeOrder(order.id)}>
                  <Text style={styles.actionBtnTxt}>🏁 {t('driver.confirmDelivery')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {/* Available orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('driver.availableOrders')}</Text>
            {orders.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeTxt}>{orders.length}</Text>
              </View>
            )}
          </View>

          {loading && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTxt}>{t('driver.loading')}</Text>
            </View>
          )}

          {!loading && orders.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>😴</Text>
              <Text style={styles.emptyTxt}>{t('driver.noOrders')}</Text>
              <Text style={styles.emptySubTxt}>{t('driver.noOrdersSub')}</Text>
            </View>
          )}

          {orders.map((order, index) => (
            <TouchableOpacity
              key={order.id}
              style={[styles.orderCard, isBusy && styles.orderCardDisabled]}
              onPress={() => openOrderDetail(order)}
              activeOpacity={0.88}
            >
              {/* Left accent stripe */}
              <View style={styles.cardStripe} />

              <View style={styles.orderCardContent}>
                {/* Top row */}
                <View style={styles.orderCardTop}>
                  <View style={styles.orderRestoBadge}>
                    <Text style={styles.orderRestoEmoji}>🍽</Text>
                  </View>
                  <View style={styles.orderRestInfo}>
                    <Text style={styles.orderRestoName}>{order.restaurants?.name}</Text>
                    <Text style={styles.orderClientTxt}>👤 {order.customer_name}</Text>
                  </View>
                  <View style={styles.totalChip}>
                    <Text style={styles.totalChipTxt}>${order.total}</Text>
                  </View>
                </View>

                {/* Address */}
                <View style={styles.orderAddrRow}>
                  <Text style={styles.orderAddrDot}>▸</Text>
                  <Text style={styles.orderAddrTxt} numberOfLines={1}>{order.customer_address}</Text>
                </View>

                {/* Items */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.itemsScroll}>
                  {(order.items || []).map((item, i) => (
                    <View key={i} style={styles.itemChip}>
                      <Text style={styles.itemChipQty}>{item.qty}×</Text>
                      <Text style={styles.itemChipName}>{item.name}</Text>
                    </View>
                  ))}
                </ScrollView>

                {/* Footer */}
                <View style={styles.orderCardFooter}>
                  {order.customer_lat && (
                    <TouchableOpacity
                      style={styles.mapsSmallBtn}
                      onPress={(e) => { e.stopPropagation(); openMaps(order.customer_lat, order.customer_lng) }}
                    >
                      <Text style={styles.mapsSmallBtnTxt}>📍 Maps</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.acceptChip, isBusy && styles.acceptChipDisabled]}
                    onPress={() => isBusy
                      ? Alert.alert(t('driver.alreadyBusy'), t('driver.alreadyBusyMsg'))
                      : acceptOrder(order.id)
                    }
                  >
                    <Text style={styles.acceptChipTxt}>
                      {isBusy ? '🔒' : '🛵'} {isBusy ? t('driver.busyShort') : t('driver.accept')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bottom sheet */}
      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={closeModal}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeModal} />
        <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: slideAnim }] }]}>
          {selectedOrder && (
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetPad}>
                {/* Sheet header */}
                <View style={styles.sheetTop}>
                  <View style={styles.sheetTopLeft}>
                    <Text style={styles.sheetResto}>{selectedOrder.restaurants?.name}</Text>
                    <Text style={styles.sheetOrderId}>#{selectedOrder.id?.substring(0, 8).toUpperCase()}</Text>
                  </View>
                  <View style={styles.sheetTotalBox}>
                    <Text style={styles.sheetTotalLabel}>Total</Text>
                    <Text style={styles.sheetTotal}>${selectedOrder.total}</Text>
                  </View>
                </View>

                {/* Map button */}
                {selectedOrder.customer_lat && (
                  <TouchableOpacity
                    style={styles.sheetMapBtn}
                    onPress={() => openMaps(selectedOrder.customer_lat, selectedOrder.customer_lng)}
                  >
                    <Text style={styles.sheetMapBtnEmoji}>🗺</Text>
                    <View>
                      <Text style={styles.sheetMapBtnTitle}>{t('driver.seeRoute')}</Text>
                      <Text style={styles.sheetMapBtnSub}>
                        {Number(selectedOrder.customer_lat).toFixed(4)}, {Number(selectedOrder.customer_lng).toFixed(4)}
                      </Text>
                    </View>
                    <Text style={styles.sheetMapArrow}>›</Text>
                  </TouchableOpacity>
                )}

                {/* Address block */}
                <View style={styles.sheetInfoBlock}>
                  <Text style={styles.sheetLabel}>{t('driver.deliveryAddress')}</Text>
                  <View style={styles.sheetAddrRow}>
                    <Text style={styles.sheetAddrPin}>📍</Text>
                    <Text style={styles.sheetAddrTxt}>{selectedOrder.customer_address}</Text>
                  </View>
                </View>

                {/* Client block */}
                <View style={styles.sheetInfoBlock}>
                  <Text style={styles.sheetLabel}>{t('driver.client')}</Text>
                  <View style={styles.sheetClientRow}>
                    <View style={styles.sheetAvatar}>
                      <Text style={styles.sheetAvatarTxt}>{selectedOrder.customer_name?.[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetClientName}>{selectedOrder.customer_name}</Text>
                      <Text style={styles.sheetClientPhone}>{selectedOrder.customer_phone}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.sheetContactBtn}
                      onPress={() => Linking.openURL(`tel:${selectedOrder.customer_phone}`)}
                    >
                      <Text style={styles.sheetContactBtnTxt}>📞</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sheetContactBtn, styles.sheetContactBtnWa]}
                      onPress={() => openWhatsApp(selectedOrder.customer_phone)}
                    >
                      <Text style={styles.sheetContactBtnTxt}>💬</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Items */}
                <View style={styles.sheetInfoBlock}>
                  <Text style={styles.sheetLabel}>{t('driver.items')} · {(selectedOrder.items || []).length}</Text>
                  {(selectedOrder.items || []).map((item, i) => (
                    <View key={i} style={styles.sheetItemRow}>
                      <View style={styles.sheetItemQtyBox}>
                        <Text style={styles.sheetItemQty}>{item.qty}</Text>
                      </View>
                      <Text style={styles.sheetItemName}>{item.name}</Text>
                      <Text style={styles.sheetItemPrice}>${(item.price * item.qty).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>

                {/* Note */}
                {selectedOrder.note && (
                  <View style={styles.sheetNote}>
                    <Text style={styles.sheetNoteLabel}>💬 {t('driver.noteFromClient')}</Text>
                    <Text style={styles.sheetNoteTxt}>{selectedOrder.note}</Text>
                  </View>
                )}

                {/* Payment */}
                <View style={[
                  styles.sheetPayRow,
                  selectedOrder.payment_method === 'whish' ? styles.sheetPayWhish : styles.sheetPayCash
                ]}>
                  <Text style={styles.sheetPayIcon}>
                    {selectedOrder.payment_method === 'whish' ? '💳' : '💵'}
                  </Text>
                  <Text style={[styles.sheetPayTxt, {
                    color: selectedOrder.payment_method === 'whish' ? '#CE93D8' : '#00C853'
                  }]}>
                    {selectedOrder.payment_method === 'whish' ? t('driver.paymentWhish') : t('driver.paymentCash')}
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.sheetActions}>
                  <TouchableOpacity style={styles.sheetCancelBtn} onPress={closeModal}>
                    <Text style={styles.sheetCancelTxt}>{t('driver.close')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sheetAcceptBtn, isBusy && styles.sheetAcceptBtnDisabled]}
                    onPress={() => isBusy
                      ? Alert.alert(t('driver.alreadyBusy'), t('driver.alreadyBusyMsg'))
                      : acceptOrder(selectedOrder.id)
                    }
                  >
                    <Text style={styles.sheetAcceptTxt}>
                      {isBusy ? `🔒 ${t('driver.alreadyBusy')}` : `🛵 ${t('driver.acceptDelivery')}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ height: 34 }} />
            </ScrollView>
          )}
        </Animated.View>
      </Modal>
    </View>
  )
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg: '#080808',
  surface: '#111111',
  card: '#161616',
  border: '#1E1E1E',
  borderLight: '#252525',
  orange: '#FF6D00',
  orangeDim: '#FF6D0018',
  green: '#00C853',
  greenDim: '#00C85318',
  blue: '#2979FF',
  blueDim: '#2979FF18',
  purple: '#AA00FF',
  purpleDim: '#AA00FF18',
  whatsapp: '#25D366',
  white: '#FFFFFF',
  gray1: '#EFEFEF',
  gray2: '#999999',
  gray3: '#555555',
  gray4: '#2A2A2A',
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 20 },

  // ── Header ──
  header: {
    backgroundColor: C.surface,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatarCircle: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.orange,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 19, letterSpacing: -0.5 },
  headerInfo: { flex: 1 },
  headerGreet: { color: C.gray3, fontSize: 11, fontWeight: '500', letterSpacing: 0.3 },
  headerName: { color: C.white, fontWeight: '700', fontSize: 17, marginTop: 1 },
  logoutBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: C.border,
  },
  logoutTxt: { color: C.gray3, fontSize: 12, fontWeight: '500' },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
  },
  statusPillFree: { backgroundColor: C.greenDim, borderColor: '#00C85330' },
  statusPillBusy: { backgroundColor: '#FF6D0012', borderColor: '#FF6D0030' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPillTxt: { fontSize: 13, fontWeight: '600' },

  // ── Active delivery card ──
  activeCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF6D0025',
    overflow: 'hidden',
  },
  activeAccentBar: { height: 3, backgroundColor: C.orange },
  activeAccentBarGreen: { backgroundColor: C.green },
  activeCardInner: { padding: 18 },

  activeStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  activeStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.orangeDim, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: '#FF6D0030',
  },
  activeStatusBadgeGreen: { backgroundColor: C.greenDim, borderColor: '#00C85330' },
  activeStatusEmoji: { fontSize: 13 },
  activeStatusTxt: { color: C.orange, fontWeight: '700', fontSize: 12 },
  activeRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activeTotal: { color: C.white, fontWeight: '800', fontSize: 20, letterSpacing: -0.5 },

  activeResto: { color: C.white, fontWeight: '700', fontSize: 19, marginBottom: 14, letterSpacing: -0.3 },
  separator: { height: 1, backgroundColor: C.border, marginBottom: 14 },

  clientBlock: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  clientAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.gray4, justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  clientAvatarTxt: { color: C.gray2, fontWeight: '700', fontSize: 15 },
  clientMeta: { flex: 1 },
  clientName: { color: C.gray1, fontWeight: '600', fontSize: 15 },
  clientPhone: { color: C.gray3, fontSize: 13, marginTop: 1 },
  contactButtons: { flexDirection: 'row', gap: 8 },
  contactBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: C.greenDim, borderWidth: 1, borderColor: '#00C85330',
    justifyContent: 'center', alignItems: 'center',
  },
  contactBtnWa: { backgroundColor: '#25D36618', borderColor: '#25D36630' },
  contactBtnTxt: { fontSize: 16 },

  addrBlock: { flexDirection: 'row', gap: 8, marginBottom: 14, alignItems: 'flex-start' },
  addrPin: { fontSize: 14, marginTop: 1 },
  addrTxt: { color: C.gray2, fontSize: 14, flex: 1, lineHeight: 20 },

  mapsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  mapBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: C.orangeDim, borderWidth: 1, borderColor: '#FF6D0025',
    alignItems: 'center',
  },
  mapBtnClient: { backgroundColor: C.blueDim, borderColor: '#2979FF25' },
  mapBtnLabel: { color: C.orange, fontWeight: '600', fontSize: 13 },

  actionBtnOrange: {
    backgroundColor: C.orange, borderRadius: 14, padding: 15, alignItems: 'center',
  },
  actionBtnGreen: {
    backgroundColor: C.green, borderRadius: 14, padding: 15, alignItems: 'center',
  },
  actionBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },

  gpsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.greenDim, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: '#00C85340',
  },
  gpsDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  gpsBadgeTxt: { color: C.green, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },

  // ── Section ──
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionTitle: { color: C.white, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  countBadge: {
    backgroundColor: C.orange, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
    minWidth: 24, alignItems: 'center',
  },
  countBadgeTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },

  // ── Order card ──
  orderCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  orderCardDisabled: { opacity: 0.45 },
  cardStripe: { width: 3, backgroundColor: C.orange },
  orderCardContent: { flex: 1, padding: 14 },

  orderCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  orderRestoBadge: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: C.orangeDim, borderWidth: 1, borderColor: '#FF6D0025',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  orderRestoEmoji: { fontSize: 18 },
  orderRestInfo: { flex: 1 },
  orderRestoName: { color: C.white, fontWeight: '700', fontSize: 15, letterSpacing: -0.2 },
  orderClientTxt: { color: C.gray3, fontSize: 12, marginTop: 2 },
  totalChip: {
    backgroundColor: C.orangeDim, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#FF6D0030',
  },
  totalChipTxt: { color: C.orange, fontWeight: '800', fontSize: 14 },

  orderAddrRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  orderAddrDot: { color: C.gray3, fontSize: 10 },
  orderAddrTxt: { color: C.gray3, fontSize: 13, flex: 1 },

  itemsScroll: { marginBottom: 10 },
  itemChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.borderLight, borderRadius: 6,
    paddingHorizontal: 9, paddingVertical: 4, marginRight: 6,
  },
  itemChipQty: { color: C.orange, fontWeight: '700', fontSize: 11 },
  itemChipName: { color: C.gray2, fontSize: 11 },

  orderCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mapsSmallBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, backgroundColor: C.blueDim,
    borderWidth: 1, borderColor: '#2979FF25',
  },
  mapsSmallBtnTxt: { color: C.blue, fontSize: 12, fontWeight: '600' },
  acceptChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    backgroundColor: C.orange,
  },
  acceptChipDisabled: { backgroundColor: C.gray4 },
  acceptChipTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },

  emptyBox: { alignItems: 'center', paddingVertical: 50 },
  emptyEmoji: { fontSize: 46, marginBottom: 14 },
  emptyTxt: { color: C.gray3, fontSize: 16, fontWeight: '600' },
  emptySubTxt: { color: C.gray4, fontSize: 13, marginTop: 6 },

  // ── Modal / Bottom sheet ──
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    maxHeight: SCREEN_H * 0.92,
    borderTopWidth: 1, borderTopColor: C.borderLight,
  },
  sheetHandle: {
    width: 36, height: 4, backgroundColor: C.borderLight,
    borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 6,
  },
  sheetPad: { paddingHorizontal: 20 },

  sheetTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 18,
  },
  sheetTopLeft: {},
  sheetResto: { color: C.white, fontWeight: '800', fontSize: 22, letterSpacing: -0.5 },
  sheetOrderId: { color: C.gray3, fontSize: 12, marginTop: 3, letterSpacing: 0.5 },
  sheetTotalBox: { alignItems: 'flex-end' },
  sheetTotalLabel: { color: C.gray3, fontSize: 11, fontWeight: '500' },
  sheetTotal: { color: C.orange, fontWeight: '800', fontSize: 24, letterSpacing: -0.5 },

  sheetMapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.greenDim,
    marginBottom: 18,
  },
  sheetMapBtnEmoji: { fontSize: 22 },
  sheetMapBtnTitle: { color: C.white, fontWeight: '600', fontSize: 14 },
  sheetMapBtnSub: { color: C.gray3, fontSize: 11, marginTop: 1 },
  sheetMapArrow: { color: C.gray3, fontSize: 22, marginLeft: 'auto' },

  sheetInfoBlock: { marginBottom: 20 },
  sheetLabel: {
    color: C.gray3, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10,
  },
  sheetAddrRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  sheetAddrPin: { fontSize: 14, marginTop: 1 },
  sheetAddrTxt: { color: C.gray1, fontSize: 15, flex: 1, lineHeight: 22 },

  sheetClientRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.gray4, justifyContent: 'center', alignItems: 'center',
  },
  sheetAvatarTxt: { color: C.gray2, fontWeight: '700', fontSize: 18 },
  sheetClientName: { color: C.white, fontWeight: '600', fontSize: 15 },
  sheetClientPhone: { color: C.gray3, fontSize: 13, marginTop: 2 },
  sheetContactBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.greenDim, borderWidth: 1, borderColor: '#00C85330',
    justifyContent: 'center', alignItems: 'center',
  },
  sheetContactBtnWa: { backgroundColor: '#25D36618', borderColor: '#25D36630' },
  sheetContactBtnTxt: { fontSize: 18 },

  sheetItemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  sheetItemQtyBox: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: C.orangeDim, justifyContent: 'center',
    alignItems: 'center', marginRight: 12,
    borderWidth: 1, borderColor: '#FF6D0025',
  },
  sheetItemQty: { color: C.orange, fontWeight: '800', fontSize: 13 },
  sheetItemName: { flex: 1, color: C.gray1, fontSize: 14 },
  sheetItemPrice: { color: C.orange, fontWeight: '700', fontSize: 14 },

  sheetNote: {
    backgroundColor: '#1A1A2E', borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: '#2979FF20',
  },
  sheetNoteLabel: { color: '#64B5F6', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  sheetNoteTxt: { color: '#90CAF9', fontSize: 14, lineHeight: 20 },

  sheetPayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1,
  },
  sheetPayCash: { backgroundColor: C.greenDim, borderColor: '#00C85325' },
  sheetPayWhish: { backgroundColor: C.purpleDim, borderColor: '#AA00FF25' },
  sheetPayIcon: { fontSize: 20 },
  sheetPayTxt: { fontWeight: '600', fontSize: 14 },

  sheetActions: { flexDirection: 'row', gap: 10 },
  sheetCancelBtn: {
    flex: 1, backgroundColor: C.card, borderRadius: 14,
    padding: 15, alignItems: 'center',
    borderWidth: 1, borderColor: C.borderLight,
  },
  sheetCancelTxt: { color: C.gray3, fontWeight: '600', fontSize: 15 },
  sheetAcceptBtn: { flex: 2, backgroundColor: C.orange, borderRadius: 14, padding: 15, alignItems: 'center' },
  sheetAcceptBtnDisabled: { backgroundColor: C.gray4 },
  sheetAcceptTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
})


