import * as Location from 'expo-location'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Alert, Linking, ScrollView, StatusBar,
  StyleSheet, Text, TextInput,
  TouchableOpacity, View
} from 'react-native'
import { useTranslation } from '../lib/LanguageContext'
import { supabase } from '../lib/supabase'

const ORANGE = '#FF6B35'
const BG = '#0a0a0a'
const CARD = '#111'
const BORDER = '#1c1c1c'
const WHITE = '#fff'
const DELIVERY_FEE = 1.40

export default function CheckoutScreen() {
  const { t } = useTranslation()
  const { cart, restaurantId, restaurantName, total } = useLocalSearchParams()
  const router = useRouter()
  const cartItems = JSON.parse(cart)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [coords, setCoords] = useState(null)
  const [loadingGPS, setLoadingGPS] = useState(false)
  const [loading, setLoading] = useState(false)
  const [payMethod, setPayMethod] = useState('cash')
  const [isPreorder, setIsPreorder] = useState(false)

  const totalWithDelivery = (parseFloat(total) + DELIVERY_FEE).toFixed(2)

  useEffect(() => {
    supabase.from('restaurants').select('is_open').eq('id', restaurantId).single()
      .then(({ data }) => {
        const open = data?.is_open === true || data?.is_open === 'true'
        setIsPreorder(!open)
      })
  }, [])

  async function getGPS() {
    setLoadingGPS(true)
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('checkout.gpsPermissionTitle'), t('checkout.gpsPermissionMsg'))
      setLoadingGPS(false)
      return
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    const geo = await Location.reverseGeocodeAsync(loc.coords)
    setCoords(loc.coords)
    if (geo[0]) {
      const parts = [geo[0].street, geo[0].district || geo[0].city, geo[0].region].filter(Boolean)
      setAddress(parts.join(', '))
    }
    setLoadingGPS(false)
  }

  async function placeOrder() {
    if (!name || !phone || !address) {
      Alert.alert(t('checkout.missingFieldsTitle'), t('checkout.missingFieldsMsg'))
      return
    }
    if (payMethod === 'whish') {
      Alert.alert(
        t('checkout.whishAlertTitle'),
        t('checkout.whishAlertMsg', { total: totalWithDelivery }),
        [
          { text: t('checkout.cancel'), style: 'cancel' },
          { text: t('checkout.orderAndPay'), onPress: () => submitOrder() }
        ]
      )
    } else {
      submitOrder()
    }
  }

  async function submitOrder() {
    setLoading(true)
    const { data, error } = await supabase.from('orders').insert({
      restaurant_id: restaurantId,
      customer_name: name,
      customer_phone: phone,
      customer_address: address,
      customer_lat: coords?.latitude || null,
      customer_lng: coords?.longitude || null,
      items: cartItems,
      total: parseFloat(totalWithDelivery),
      status: isPreorder ? 'preorder' : 'pending',
      payment_method: payMethod,
      payment_status: payMethod === 'whish' ? 'waiting' : 'cash',
      note: note || null,
      is_preorder: isPreorder,
    }).select().single()

    setLoading(false)
    if (error) { Alert.alert(t('checkout.errorTitle'), t('checkout.orderFailed')); return }
    if (payMethod === 'whish') {
      Linking.openURL(WHISH_LINK).catch(() => Alert.alert(t('checkout.errorTitle'), t('checkout.whishOpenError')))
    }
    router.push({ pathname: '/confirmation', params: { phone, payMethod, orderId: data?.id, isPreorder: isPreorder ? '1' : '0' } })
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Fixed Header ── */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.topTitle}>{t('checkout.title')}</Text>
          <Text style={s.topSub} numberOfLines={1}>🍽️  {restaurantName}</Text>
        </View>
        <View style={s.totalPill}>
          <Text style={s.totalPillTxt}>${totalWithDelivery}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Preorder banner ── */}
        {isPreorder && (
          <View style={s.preorderBanner}>
            <Text style={s.preorderEmoji}>⏰</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.preorderTitle}>Précommande</Text>
              <Text style={s.preorderSub}>Restaurant fermé — ta commande sera envoyée à l'ouverture.</Text>
            </View>
          </View>
        )}

        {/* ── Order summary ── */}
        <View style={s.section}>
          <Text style={s.secLabel}>RÉCAPITULATIF</Text>
          <View style={s.card}>
            {cartItems.map((item, i) => (
              <View key={i} style={[s.itemRow, i < cartItems.length - 1 && s.itemRowBorder]}>
                <View style={s.qtyBox}>
                  <Text style={s.qtyTxt}>{item.qty}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName}>{item.name}</Text>
                  {item.selectedOptions?.length > 0 && (
                    <Text style={s.itemOpts}>+ {item.selectedOptions.map(o => o.name).join(', ')}</Text>
                  )}
                </View>
                <Text style={s.itemPrice}>${(item.price * item.qty).toFixed(2)}</Text>
              </View>
            ))}
          </View>
          <View style={s.totalsCard}>
            <View style={s.totRow}>
              <Text style={s.totLabel}>{t('checkout.delivery')}</Text>
              <Text style={[s.totLabel, { color: ORANGE }]}>${DELIVERY_FEE.toFixed(2)}</Text>
            </View>
            <View style={[s.totRow, s.grandRow]}>
              <Text style={s.grandLabel}>{t('checkout.total')}</Text>
              <Text style={s.grandAmt}>${totalWithDelivery}</Text>
            </View>
          </View>
        </View>

        {/* ── Infos client ── */}
        <View style={s.section}>
          <Text style={s.secLabel}>VOS INFORMATIONS</Text>
          <View style={s.card}>
            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>{t('checkout.fullName')}</Text>
              <TextInput
                style={s.input}
                placeholder={t('checkout.fullNamePlaceholder')}
                placeholderTextColor="#2e2e2e"
                value={name}
                onChangeText={setName}
              />
            </View>
            <View style={[s.inputWrap, { borderTopWidth: 1, borderTopColor: BORDER }]}>
              <Text style={s.inputLabel}>{t('checkout.phone')}</Text>
              <TextInput
                style={s.input}
                placeholder={t('checkout.phonePlaceholder')}
                placeholderTextColor="#2e2e2e"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        {/* ── Adresse ── */}
        <View style={s.section}>
          <Text style={s.secLabel}>ADRESSE DE LIVRAISON</Text>
          <TouchableOpacity
            style={[s.gpsBtn, loadingGPS && { opacity: 0.5 }, coords && s.gpsBtnDone]}
            onPress={getGPS}
            disabled={loadingGPS}
          >
            <Text style={s.gpsBtnEmoji}>{coords ? '📌' : '📍'}</Text>
            <Text style={[s.gpsBtnTxt, coords && s.gpsBtnTxtDone]}>
              {loadingGPS ? t('checkout.gpsLoading') : coords ? t('checkout.gpsSet') : t('checkout.gpsUse')}
            </Text>
          </TouchableOpacity>
          {coords && (
            <View style={s.coordsBox}>
              <Text style={s.coordsTxt}>{coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</Text>
            </View>
          )}
          <View style={[s.card, { marginTop: 10 }]}>
            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>{t('checkout.fullAddress')}</Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                placeholder={t('checkout.addressPlaceholder')}
                placeholderTextColor="#2e2e2e"
                value={address}
                onChangeText={setAddress}
                multiline
              />
            </View>
          </View>
        </View>

        {/* ── Paiement ── */}
        <View style={s.section}>
          <Text style={s.secLabel}>MODE DE PAIEMENT</Text>
          <View style={s.payRow}>
            <TouchableOpacity
              style={[s.payCard, payMethod === 'cash' && s.payCardOrangeActive]}
              onPress={() => setPayMethod('cash')}
              activeOpacity={0.8}
            >
              {payMethod === 'cash' && <View style={s.payCheckDot} />}
              <Text style={s.payEmoji}>💵</Text>
              <Text style={[s.payCardLabel, payMethod === 'cash' && { color: ORANGE }]}>{t('checkout.cash')}</Text>
              <Text style={s.payCardSub}>{t('checkout.cashSub')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.payCard, payMethod === 'whish' && s.payCardWhishActive]}
              onPress={() => setPayMethod('whish')}
              activeOpacity={0.8}
            >
              {payMethod === 'whish' && <View style={[s.payCheckDot, { backgroundColor: '#6C3EE8' }]} />}
              <Text style={s.payEmoji}>📱</Text>
              <Text style={[s.payCardLabel, payMethod === 'whish' && { color: '#6C3EE8' }]}>{t('checkout.whish')}</Text>
              <Text style={s.payCardSub}>{t('checkout.whishSub')}</Text>
            </TouchableOpacity>
          </View>

          {payMethod === 'whish' && (
            <View style={s.whishBox}>
              <Text style={s.whishTitle}>{t('checkout.whishHow')}</Text>
              {[t('checkout.whishStep1'), t('checkout.whishStep2'), t('checkout.whishStep3')].map((step, i) => (
                <Text key={i} style={s.whishStep}>{step}</Text>
              ))}
              <View style={s.whishAmtBox}>
                <Text style={s.whishAmt}>💰  ${totalWithDelivery}</Text>
              </View>
              {[t('checkout.whishStep4'), t('checkout.whishStep5')].map((step, i) => (
                <Text key={i} style={s.whishStep}>{step}</Text>
              ))}
            </View>
          )}
        </View>

        {/* ── Note ── */}
        <View style={s.section}>
          <Text style={s.secLabel}>NOTE POUR LE RESTAURANT</Text>
          <View style={s.card}>
            <View style={s.inputWrap}>
              <TextInput
                style={[s.input, s.inputMulti]}
                placeholder={t('checkout.notePlaceholder')}
                placeholderTextColor="#2e2e2e"
                value={note}
                onChangeText={setNote}
                multiline
              />
            </View>
          </View>
        </View>

        {/* ── Order button ── */}
        <TouchableOpacity
          style={[
            s.orderBtn,
            payMethod === 'whish' && !isPreorder && s.orderBtnWhish,
            isPreorder && s.orderBtnPreorder,
            loading && { opacity: 0.6 }
          ]}
          onPress={placeOrder}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={s.orderBtnTxt}>
            {loading
              ? '⏳  Envoi en cours...'
              : isPreorder
                ? `⏰  Précommander — $${totalWithDelivery}`
                : payMethod === 'whish'
                  ? `📱  ${t('checkout.orderBtnWhish')} — $${totalWithDelivery}`
                  : `🛵  ${t('checkout.orderBtn')} — $${totalWithDelivery}`}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: BG },

  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0c0c0c',
    paddingTop: 58, paddingBottom: 16, paddingHorizontal: 18,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn:      { width: 38, height: 38, borderRadius: 12, backgroundColor: CARD, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  backArrow:    { color: WHITE, fontSize: 18 },
  topTitle:     { color: WHITE, fontSize: 17, fontWeight: '700' },
  topSub:       { color: '#444', fontSize: 12, marginTop: 2 },
  totalPill:    { backgroundColor: ORANGE + '18', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: ORANGE + '40' },
  totalPillTxt: { color: ORANGE, fontWeight: '800', fontSize: 15 },

  scroll:       { padding: 18, paddingTop: 20 },

  preorderBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0e0e2a', borderRadius: 16, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: '#2a2a6a',
  },
  preorderEmoji:  { fontSize: 26 },
  preorderTitle:  { color: '#9a98ff', fontWeight: '700', fontSize: 14, marginBottom: 3 },
  preorderSub:    { color: '#4a4a7a', fontSize: 12, lineHeight: 18 },

  section:      { marginBottom: 24 },
  secLabel:     { color: '#2a2a2a', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10, paddingLeft: 2 },
  card:         { backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },

  itemRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  itemRowBorder:{ borderBottomWidth: 1, borderBottomColor: BORDER },
  qtyBox:       { width: 28, height: 28, borderRadius: 8, backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center' },
  qtyTxt:       { color: WHITE, fontWeight: '800', fontSize: 12 },
  itemName:     { color: WHITE, fontSize: 14, fontWeight: '600' },
  itemOpts:     { color: '#7a4aaa', fontSize: 11, marginTop: 2 },
  itemPrice:    { color: ORANGE, fontWeight: '700', fontSize: 14 },

  totalsCard:   { backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER, marginTop: 8, padding: 14 },
  totRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  totLabel:     { color: '#444', fontSize: 14 },
  totFree:      { color: '#4CAF50', fontWeight: '700', fontSize: 14 },
  grandRow:     { marginBottom: 0, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  grandLabel:   { color: WHITE, fontSize: 17, fontWeight: '700' },
  grandAmt:     { color: ORANGE, fontSize: 20, fontWeight: '800' },

  inputWrap:    { padding: 14 },
  inputLabel:   { color: '#333', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  input:        { color: WHITE, fontSize: 15, paddingVertical: 0 },
  inputMulti:   { height: 70, textAlignVertical: 'top' },

  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0a1f10', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#1a4a20',
  },
  gpsBtnDone:   { backgroundColor: '#0a2010', borderColor: '#2a6a30' },
  gpsBtnEmoji:  { fontSize: 16 },
  gpsBtnTxt:    { color: '#4CAF50', fontWeight: '700', fontSize: 14 },
  gpsBtnTxtDone:{ color: '#66BB6A' },
  coordsBox:    { backgroundColor: '#0a1f10', borderRadius: 10, padding: 8, marginTop: 6, borderWidth: 1, borderColor: '#1a4a20', alignItems: 'center' },
  coordsTxt:    { color: '#4CAF50', fontSize: 11 },

  payRow:       { flexDirection: 'row', gap: 10 },
  payCard:      { flex: 1, backgroundColor: CARD, borderRadius: 18, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: BORDER, position: 'relative' },
  payCardOrangeActive: { borderColor: ORANGE, backgroundColor: '#1a0c08' },
  payCardWhishActive:  { borderColor: '#6C3EE8', backgroundColor: '#100a1a' },
  payCheckDot:  { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE },
  payEmoji:     { fontSize: 26, marginBottom: 8 },
  payCardLabel: { color: '#666', fontWeight: '700', fontSize: 14, marginBottom: 3 },
  payCardSub:   { color: '#333', fontSize: 11, textAlign: 'center' },
  whishBox:     { marginTop: 10, backgroundColor: '#0e0820', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#6C3EE830' },
  whishTitle:   { color: '#9C7EE8', fontWeight: '700', fontSize: 14, marginBottom: 10 },
  whishStep:    { color: '#666', fontSize: 13, marginBottom: 6, lineHeight: 20 },
  whishAmtBox:  { backgroundColor: '#6C3EE820', borderRadius: 12, padding: 12, alignItems: 'center', marginVertical: 8, borderWidth: 1, borderColor: '#6C3EE8' },
  whishAmt:     { color: '#a07af0', fontWeight: '800', fontSize: 22 },

  orderBtn: {
    backgroundColor: ORANGE, borderRadius: 18, padding: 18,
    alignItems: 'center',
    shadowColor: ORANGE, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
  },
  orderBtnWhish:    { backgroundColor: '#6C3EE8', shadowColor: '#6C3EE8' },
  orderBtnPreorder: { backgroundColor: '#4a48a0', shadowColor: '#4a48a0' },
  orderBtnTxt:      { color: WHITE, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
})