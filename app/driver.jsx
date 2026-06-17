import { useEffect, useState, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Linking, Animated, Dimensions, Modal, StatusBar,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Location from 'expo-location'
import { supabase } from '../lib/supabase'
import { useTranslation } from '../lib/LanguageContext'

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
  const locationSubRef = useRef(null)
  const activeOrderIdRef = useRef(null)
  const router = useRouter()

  const isBusy = myOrders.length > 0

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
    // Nettoyer le numéro (enlever espaces, tirets, +)
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

        {/* Status banner */}
        <View style={[styles.statusBanner, isBusy ? styles.statusBannerBusy : styles.statusBannerFree]}>
          <View style={[styles.statusDot, { backgroundColor: isBusy ? '#9C27B0' : '#4CAF50' }]} />
          <Text style={[styles.statusBannerTxt, { color: isBusy ? '#CE93D8' : '#A5D6A7' }]}>
            {isBusy
              ? t('driver.busy')
              : `${orders.length} ${orders.length !== 1 ? t('driver.availablePlural') : t('driver.available')} ${orders.length !== 1 ? t('driver.availableSuffixPlural') : t('driver.availableSuffix')}`}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Ma livraison active */}
        {myOrders.map(order => (
          <View key={order.id} style={styles.activeDelivery}>
            <View style={styles.activeHeader}>
              <View style={styles.activeTag}>
                <View style={styles.activePulse} />
                <Text style={styles.activeTagTxt}>
                  {order.status === 'preparing' ? t('driver.preparingLabel') : t('driver.onTheWayToClient')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {gpsActive && (
                  <View style={styles.gpsBadge}>
                    <View style={styles.gpsDot} />
                    <Text style={styles.gpsBadgeTxt}>{t('driver.gpsLive')}</Text>
                  </View>
                )}
                <Text style={styles.activeTotal}>${order.total}</Text>
              </View>
            </View>

            <Text style={styles.activeRestoName}>{order.restaurants?.name}</Text>
            <View style={styles.divider} />

            <View style={styles.clientRow}>
              <View style={styles.clientIcon}>
                <Text style={styles.clientIconTxt}>{order.customer_name?.[0]?.toUpperCase()}</Text>
              </View>
              <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{order.customer_name}</Text>
                <Text style={styles.clientPhone}>{order.customer_phone}</Text>
              </View>

              {/* Bouton Appel */}
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}
              >
                <Text style={styles.callBtnTxt}>{t('driver.call')}</Text>
              </TouchableOpacity>

              {/* Bouton WhatsApp */}
              <TouchableOpacity
                style={styles.whatsappBtn}
                onPress={() => openWhatsApp(order.customer_phone)}
              >
                <Text style={styles.whatsappEmoji}>📱</Text>
                <Text style={styles.whatsappTxt}>WA</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.addrRow}>
              <Text style={styles.addrDot}>📍</Text>
              <Text style={styles.addrTxt}>{order.customer_address}</Text>
            </View>

            {/* GPS buttons */}
            <View style={styles.mapsRow}>
              {order.restaurants?.lat && (
                <TouchableOpacity
                  style={styles.mapsBtn}
                  onPress={() => openMaps(order.restaurants.lat, order.restaurants.lng)}
                >
                  <Text style={styles.mapsBtnEmoji}>🏪</Text>
                  <Text style={styles.mapsBtnTxt}>{t('driver.toRestaurant')}</Text>
                </TouchableOpacity>
              )}
              {order.customer_lat && (
                <TouchableOpacity
                  style={[styles.mapsBtn, styles.mapsBtnClient]}
                  onPress={() => openMaps(order.customer_lat, order.customer_lng)}
                >
                  <Text style={styles.mapsBtnEmoji}>🏠</Text>
                  <Text style={[styles.mapsBtnTxt, { color: '#90CAF9' }]}>{t('driver.toClient')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {order.status === 'preparing' ? (
              <TouchableOpacity style={styles.pickupBtn} onPress={() => pickupOrder(order.id)}>
                <Text style={styles.pickupBtnTxt}>{t('driver.pickedUp')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.deliveredBtn} onPress={() => completeOrder(order.id)}>
                <Text style={styles.deliveredBtnTxt}>{t('driver.confirmDelivery')}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Liste commandes disponibles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('driver.availableOrders')}</Text>

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

          {orders.map(order => (
            <TouchableOpacity
              key={order.id}
              style={[styles.orderCard, isBusy && styles.orderCardDisabled]}
              onPress={() => openOrderDetail(order)}
              activeOpacity={0.85}
            >
              {order.customer_lat ? (
                <View style={styles.mapPreview}>
                  <View style={styles.mapPlaceholder}>
                    <Text style={styles.mapPlaceholderTxt}>📍 {order.customer_address}</Text>
                  </View>
                  <View style={styles.mapOverlay}>
                    <TouchableOpacity
                      style={styles.mapOpenBtn}
                      onPress={(e) => {
                        e.stopPropagation()
                        openMaps(order.customer_lat, order.customer_lng)
                      }}
                    >
                      <Text style={styles.mapOpenBtnTxt}>{t('driver.openInMaps')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.mapPreviewNoGps}>
                  <Text style={styles.mapPreviewNoGpsTxt}>📍 {order.customer_address}</Text>
                </View>
              )}

              <View style={styles.orderCardBody}>
                <View style={styles.orderCardTop}>
                  <Text style={styles.orderRestoName}>{order.restaurants?.name}</Text>
                  <View style={styles.totalPill}>
                    <Text style={styles.totalPillTxt}>${order.total}</Text>
                  </View>
                </View>

                <Text style={styles.orderClientName}>👤 {order.customer_name}</Text>
                <Text style={styles.orderAddr} numberOfLines={1}>📍 {order.customer_address}</Text>

                <View style={styles.itemsRow}>
                  {(order.items || []).slice(0, 3).map((item, i) => (
                    <View key={i} style={styles.itemPill}>
                      <Text style={styles.itemPillTxt}>{item.qty}x {item.name}</Text>
                    </View>
                  ))}
                  {(order.items || []).length > 3 && (
                    <View style={styles.itemPill}>
                      <Text style={styles.itemPillTxt}>+{order.items.length - 3}</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.acceptBtnCard, isBusy && styles.acceptBtnDisabled]}
                  onPress={() => isBusy
                    ? Alert.alert(t('driver.alreadyBusy'), t('driver.alreadyBusyMsg'))
                    : acceptOrder(order.id)
                  }
                >
                  <Text style={styles.acceptBtnCardTxt}>
                    {isBusy ? t('driver.busyShort') : `🛵 ${t('driver.accept')}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bottom sheet detail commande */}
      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={closeModal}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeModal} />
        <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: slideAnim }] }]}>
          {selectedOrder && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetPadding}>
                <View style={styles.sheetHeader}>
                  <View>
                    <Text style={styles.sheetResto}>{selectedOrder.restaurants?.name}</Text>
                    <Text style={styles.sheetOrderId}>#{selectedOrder.id?.substring(0, 8).toUpperCase()}</Text>
                  </View>
                  <View style={styles.sheetTotalBox}>
                    <Text style={styles.sheetTotalLabel}>{t('driver.total')}</Text>
                    <Text style={styles.sheetTotal}>${selectedOrder.total}</Text>
                  </View>
                </View>

                <View style={styles.sheetMapBox}>
                  {selectedOrder.customer_lat ? (
                    <TouchableOpacity
                      style={styles.sheetMapBtn}
                      onPress={() => openMaps(selectedOrder.customer_lat, selectedOrder.customer_lng)}
                    >
                      <Text style={styles.sheetMapBtnTxt}>{t('driver.seeRoute')}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <View style={styles.sheetMapPlaceholder}>
                    <Text style={styles.sheetMapAddr}>📍 {selectedOrder.customer_address}</Text>
                    {selectedOrder.customer_lat && (
                      <Text style={styles.sheetMapCoords}>
                        {Number(selectedOrder.customer_lat).toFixed(5)}, {Number(selectedOrder.customer_lng).toFixed(5)}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.sheetSection}>
                  <Text style={styles.sheetSectionLabel}>{t('driver.client')}</Text>
                  <View style={styles.sheetClientRow}>
                    <View style={styles.sheetAvatar}>
                      <Text style={styles.sheetAvatarTxt}>{selectedOrder.customer_name?.[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetClientName}>{selectedOrder.customer_name}</Text>
                      <Text style={styles.sheetClientPhone}>{selectedOrder.customer_phone}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.sheetCallBtn}
                      onPress={() => Linking.openURL(`tel:${selectedOrder.customer_phone}`)}
                    >
                      <Text style={styles.sheetCallBtnTxt}>📞 {t('driver.call')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.sheetWhatsappBtn}
                      onPress={() => openWhatsApp(selectedOrder.customer_phone)}
                    >
                      <Text style={styles.sheetWhatsappTxt}>💬 WA</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.sheetSection}>
                  <Text style={styles.sheetSectionLabel}>{t('driver.deliveryAddress')}</Text>
                  <Text style={styles.sheetAddrTxt}>{selectedOrder.customer_address}</Text>
                </View>

                <View style={styles.sheetSection}>
                  <Text style={styles.sheetSectionLabel}>{t('driver.items')} ({(selectedOrder.items || []).length})</Text>
                  {(selectedOrder.items || []).map((item, i) => (
                    <View key={i} style={styles.sheetItem}>
                      <View style={styles.sheetItemQty}>
                        <Text style={styles.sheetItemQtyTxt}>{item.qty}</Text>
                      </View>
                      <Text style={styles.sheetItemName}>{item.name}</Text>
                      <Text style={styles.sheetItemPrice}>${(item.price * item.qty).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>

                {selectedOrder.note && (
                  <View style={styles.sheetNote}>
                    <Text style={styles.sheetNoteLabel}>{t('driver.noteFromClient')}</Text>
                    <Text style={styles.sheetNoteTxt}>{selectedOrder.note}</Text>
                  </View>
                )}

                <View style={[styles.sheetPayBadge,
                  selectedOrder.payment_method === 'whish' ? styles.sheetPayWhish : styles.sheetPayCash
                ]}>
                  <Text style={[styles.sheetPayTxt,
                    { color: selectedOrder.payment_method === 'whish' ? '#CE93D8' : '#A5D6A7' }
                  ]}>
                    {selectedOrder.payment_method === 'whish' ? t('driver.paymentWhish') : t('driver.paymentCash')}
                  </Text>
                </View>

                <View style={styles.sheetActions}>
                  <TouchableOpacity style={styles.sheetCancelBtn} onPress={closeModal}>
                    <Text style={styles.sheetCancelBtnTxt}>{t('driver.close')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sheetAcceptBtn, isBusy && styles.sheetAcceptBtnDisabled]}
                    onPress={() => isBusy
                      ? Alert.alert(t('driver.alreadyBusy'), t('driver.alreadyBusyMsg'))
                      : acceptOrder(selectedOrder.id)
                    }
                  >
                    <Text style={styles.sheetAcceptBtnTxt}>
                      {isBusy ? `🔒 ${t('driver.alreadyBusy')}` : t('driver.acceptDelivery')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 30 }} />
              </View>
            </ScrollView>
          )}
        </Animated.View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  scroll: { paddingBottom: 20 },
  header: { backgroundColor: '#141414', paddingTop: 58, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  headerInfo: { flex: 1 },
  headerGreet: { color: '#666', fontSize: 12 },
  headerName: { color: '#fff', fontWeight: '700', fontSize: 18 },
  logoutBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  logoutTxt: { color: '#555', fontSize: 13 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  statusBannerFree: { backgroundColor: '#0a2e10' },
  statusBannerBusy: { backgroundColor: '#1a0a2e' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBannerTxt: { fontSize: 13, fontWeight: '600' },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 14 },
  activeDelivery: { margin: 16, marginBottom: 0, backgroundColor: '#141414', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#9C27B044' },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  activeTag: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  activePulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9C27B0' },
  activeTagTxt: { color: '#CE93D8', fontWeight: '700', fontSize: 13 },
  activeTotal: { color: '#FF6B35', fontWeight: '700', fontSize: 18 },
  activeRestoName: { color: '#fff', fontWeight: '700', fontSize: 18, marginBottom: 14 },
  divider: { height: 1, backgroundColor: '#1f1f1f', marginBottom: 14 },
  clientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  clientIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  clientIconTxt: { color: '#888', fontWeight: '700', fontSize: 16 },
  clientInfo: { flex: 1 },
  clientName: { color: '#fff', fontWeight: '600', fontSize: 15 },
  clientPhone: { color: '#666', fontSize: 13, marginTop: 1 },
  callBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: '#1a3a1a', borderWidth: 1, borderColor: '#2a5a2a' },
  callBtnTxt: { color: '#4CAF50', fontSize: 13, fontWeight: '600' },
  whatsappBtn: {
    marginLeft: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, backgroundColor: '#0a2e12',
    borderWidth: 1, borderColor: '#25D36644',
  },
  whatsappEmoji: { fontSize: 14 },
  whatsappTxt: { color: '#25D366', fontSize: 12, fontWeight: '700' },
  addrRow: { flexDirection: 'row', gap: 8, marginBottom: 14, alignItems: 'flex-start' },
  addrDot: { fontSize: 14, marginTop: 1 },
  addrTxt: { color: '#999', fontSize: 14, flex: 1, lineHeight: 20 },
  mapsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  mapsBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#FF6B3533' },
  mapsBtnClient: { borderColor: '#2196F333' },
  mapsBtnEmoji: { fontSize: 16 },
  mapsBtnTxt: { color: '#FF6B35', fontWeight: '600', fontSize: 13 },
  deliveredBtn: { backgroundColor: '#0a2e10', borderRadius: 12, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: '#4CAF5044' },
  deliveredBtnTxt: { color: '#4CAF50', fontWeight: '700', fontSize: 15 },
  pickupBtn: { backgroundColor: '#FF6B3522', borderRadius: 12, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: '#FF6B3544' },
  pickupBtnTxt: { color: '#FF6B35', fontWeight: '700', fontSize: 15 },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#4CAF5022', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#4CAF5044' },
  gpsDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
  gpsBadgeTxt: { color: '#4CAF50', fontSize: 11, fontWeight: '700' },
  orderCard: { backgroundColor: '#141414', borderRadius: 18, marginBottom: 14, borderWidth: 1, borderColor: '#1f1f1f', overflow: 'hidden' },
  orderCardDisabled: { opacity: 0.5 },
  mapPreview: { height: 100, backgroundColor: '#0d1a0d', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  mapPlaceholder: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', padding: 12 },
  mapPlaceholderTxt: { color: '#4CAF5066', fontSize: 13, textAlign: 'center' },
  mapOverlay: { position: 'absolute', bottom: 8, right: 8 },
  mapOpenBtn: { backgroundColor: '#00000099', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  mapOpenBtnTxt: { color: '#4CAF50', fontSize: 12, fontWeight: '600' },
  mapPreviewNoGps: { backgroundColor: '#1a1a1a', padding: 14 },
  mapPreviewNoGpsTxt: { color: '#555', fontSize: 13 },
  orderCardBody: { padding: 14 },
  orderCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderRestoName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  totalPill: { backgroundColor: '#FF6B3522', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  totalPillTxt: { color: '#FF6B35', fontWeight: '700', fontSize: 14 },
  orderClientName: { color: '#999', fontSize: 13, marginBottom: 3 },
  orderAddr: { color: '#666', fontSize: 13, marginBottom: 10 },
  itemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  itemPill: { backgroundColor: '#1f1f1f', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  itemPillTxt: { color: '#888', fontSize: 12 },
  acceptBtnCard: { backgroundColor: '#9C27B0', borderRadius: 10, padding: 12, alignItems: 'center' },
  acceptBtnDisabled: { backgroundColor: '#2a2a2a' },
  acceptBtnCardTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyBox: { alignItems: 'center', paddingVertical: 50 },
  emptyEmoji: { fontSize: 48, marginBottom: 14 },
  emptyTxt: { color: '#666', fontSize: 16, fontWeight: '600' },
  emptySubTxt: { color: '#444', fontSize: 13, marginTop: 6 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#141414', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SCREEN_H * 0.9, borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  sheetHandle: { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetPadding: { paddingHorizontal: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1f1f1f', marginBottom: 16 },
  sheetResto: { color: '#fff', fontWeight: '700', fontSize: 20 },
  sheetOrderId: { color: '#555', fontSize: 12, marginTop: 3 },
  sheetTotalBox: { alignItems: 'flex-end' },
  sheetTotalLabel: { color: '#666', fontSize: 11 },
  sheetTotal: { color: '#FF6B35', fontWeight: '700', fontSize: 22 },
  sheetMapBox: { backgroundColor: '#0d0d0d', borderRadius: 14, overflow: 'hidden', marginBottom: 18, borderWidth: 1, borderColor: '#1f1f1f' },
  sheetMapPlaceholder: { padding: 20, alignItems: 'center', minHeight: 100, justifyContent: 'center' },
  sheetMapAddr: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 6 },
  sheetMapCoords: { color: '#4CAF5088', fontSize: 11, textAlign: 'center' },
  sheetMapBtn: { backgroundColor: '#0a2e10', padding: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1f1f1f' },
  sheetMapBtnTxt: { color: '#4CAF50', fontWeight: '600', fontSize: 14 },
  sheetSection: { marginBottom: 18 },
  sheetSectionLabel: { color: '#555', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  sheetClientRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2a2a2a', justifyContent: 'center', alignItems: 'center' },
  sheetAvatarTxt: { color: '#888', fontWeight: '700', fontSize: 17 },
  sheetClientName: { color: '#fff', fontWeight: '600', fontSize: 15 },
  sheetClientPhone: { color: '#666', fontSize: 13, marginTop: 2 },
  sheetCallBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#0a2e10', borderWidth: 1, borderColor: '#2a5a2a' },
  sheetCallBtnTxt: { color: '#4CAF50', fontSize: 13, fontWeight: '600' },
  sheetWhatsappBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#0a2e12', borderWidth: 1, borderColor: '#25D36644' },
  sheetWhatsappTxt: { color: '#25D366', fontSize: 13, fontWeight: '600' },
  sheetAddrTxt: { color: '#aaa', fontSize: 15, lineHeight: 22 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  sheetItemQty: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FF6B3522', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  sheetItemQtyTxt: { color: '#FF6B35', fontWeight: '700', fontSize: 13 },
  sheetItemName: { flex: 1, color: '#ccc', fontSize: 14 },
  sheetItemPrice: { color: '#FF6B35', fontWeight: '600', fontSize: 14 },
  sheetNote: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#2196F322' },
  sheetNoteLabel: { color: '#2196F3', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  sheetNoteTxt: { color: '#90CAF9', fontSize: 14, lineHeight: 20 },
  sheetPayBadge: { borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 20, borderWidth: 1 },
  sheetPayCash: { backgroundColor: '#0a2e10', borderColor: '#4CAF5033' },
  sheetPayWhish: { backgroundColor: '#1a0a2e', borderColor: '#9C27B033' },
  sheetPayTxt: { fontWeight: '600', fontSize: 14 },
  sheetActions: { flexDirection: 'row', gap: 10 },
  sheetCancelBtn: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  sheetCancelBtnTxt: { color: '#666', fontWeight: '600', fontSize: 15 },
  sheetAcceptBtn: { flex: 2, backgroundColor: '#9C27B0', borderRadius: 12, padding: 15, alignItems: 'center' },
  sheetAcceptBtnDisabled: { backgroundColor: '#2a2a2a' },
  sheetAcceptBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
