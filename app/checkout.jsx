import * as Location from 'expo-location'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Alert, Linking,
  ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native'
import { useTranslation } from '../lib/LanguageContext'
import { supabase } from '../lib/supabase'

const WHISH_LINK = 'https://whish.money/pay/TON_LIEN_ICI'

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
  const [restoOpen, setRestoOpen] = useState(true)

  useEffect(() => {
    supabase
      .from('restaurants')
      .select('is_open')
      .eq('id', restaurantId)
      .single()
      .then(({ data }) => {
        const open = data?.is_open === true || data?.is_open === 'true'
        setRestoOpen(open)
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
        t('checkout.whishAlertMsg', { total }),
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

    // Si précommande : status = 'preorder', le resto ne voit pas la commande tant qu'il est fermé
    const orderStatus = isPreorder ? 'preorder' : 'pending'

    const { data, error } = await supabase.from('orders').insert({
      restaurant_id: restaurantId,
      customer_name: name,
      customer_phone: phone,
      customer_address: address,
      customer_lat: coords?.latitude || null,
      customer_lng: coords?.longitude || null,
      items: cartItems,
      total: parseFloat(total),
      status: orderStatus,
      payment_method: payMethod,
      payment_status: payMethod === 'whish' ? 'waiting' : 'cash',
      note: note || null,
      is_preorder: isPreorder,
    }).select().single()

    setLoading(false)
    if (error) {
      Alert.alert(t('checkout.errorTitle'), t('checkout.orderFailed'))
      return
    }
    if (payMethod === 'whish') {
      Linking.openURL(WHISH_LINK).catch(() =>
        Alert.alert(t('checkout.errorTitle'), t('checkout.whishOpenError'))
      )
    }
    router.push({
      pathname: '/confirmation',
      params: { phone, payMethod, orderId: data?.id, isPreorder: isPreorder ? '1' : '0' }
    })
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>{t('checkout.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('checkout.title')}</Text>
        <Text style={styles.restoName}>🍽️ {restaurantName}</Text>

        {/* Bannière précommande */}
        {isPreorder && (
          <View style={styles.preorderBanner}>
            <Text style={styles.preorderEmoji}>⏰</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.preorderTitle}>Précommande</Text>
              <Text style={styles.preorderSub}>
                Le restaurant est fermé. Ta commande sera envoyée au restaurant dès qu'il ouvrira.
              </Text>
            </View>
          </View>
        )}

        {/* Récap */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('checkout.summary')}</Text>
          <View style={styles.itemsBox}>
            {cartItems.map((item, i) => (
              <View key={i} style={[styles.item, i < cartItems.length - 1 && styles.itemBorder]}>
                <View style={styles.itemLeft}>
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyText}>{item.qty}</Text>
                  </View>
                  <View>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.selectedOptions && item.selectedOptions.length > 0 && (
                      <Text style={styles.itemOptions}>
                        + {item.selectedOptions.map(o => o.name).join(', ')}
                      </Text>
                    )}
                  </View>
                </View>
                <Text style={styles.itemPrice}>${(item.price * item.qty).toFixed(2)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('checkout.delivery')}</Text>
            <Text style={styles.freeText}>{t('checkout.free')}</Text>
          </View>
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>{t('checkout.total')}</Text>
            <Text style={styles.grandAmount}>${total}</Text>
          </View>
        </View>

        {/* Infos client */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('checkout.yourInfo')}</Text>
          <Text style={styles.inputLabel}>{t('checkout.fullName')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('checkout.fullNamePlaceholder')}
            placeholderTextColor="#555"
            value={name}
            onChangeText={setName}
          />
          <Text style={styles.inputLabel}>{t('checkout.phone')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('checkout.phonePlaceholder')}
            placeholderTextColor="#555"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* Adresse */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('checkout.addressSection')}</Text>
          <TouchableOpacity
            style={[styles.gpsBtn, loadingGPS && styles.gpsBtnLoading]}
            onPress={getGPS}
            disabled={loadingGPS}
          >
            <Text style={styles.gpsBtnText}>
              {loadingGPS ? t('checkout.gpsLoading') : coords ? t('checkout.gpsSet') : t('checkout.gpsUse')}
            </Text>
          </TouchableOpacity>
          {coords && (
            <View style={styles.coordsBadge}>
              <Text style={styles.coordsText}>📌 {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</Text>
            </View>
          )}
          <Text style={[styles.inputLabel, { marginTop: 12 }]}>{t('checkout.fullAddress')}</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder={t('checkout.addressPlaceholder')}
            placeholderTextColor="#555"
            value={address}
            onChangeText={setAddress}
            multiline
          />
        </View>

        {/* Paiement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('checkout.paymentSection')}</Text>
          <View style={styles.payRow}>
            <TouchableOpacity
              style={[styles.payCard, payMethod === 'cash' && styles.payCardCashActive]}
              onPress={() => setPayMethod('cash')}
            >
              <Text style={styles.payEmoji}>💵</Text>
              <Text style={[styles.payLabel, payMethod === 'cash' && styles.payLabelCash]}>{t('checkout.cash')}</Text>
              <Text style={styles.paySub}>{t('checkout.cashSub')}</Text>
              {payMethod === 'cash' && <View style={styles.checkDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.payCard, payMethod === 'whish' && styles.payCardWhishActive]}
              onPress={() => setPayMethod('whish')}
            >
              <Text style={styles.payEmoji}>📱</Text>
              <Text style={[styles.payLabel, payMethod === 'whish' && styles.payLabelWhish]}>{t('checkout.whish')}</Text>
              <Text style={styles.paySub}>{t('checkout.whishSub')}</Text>
              {payMethod === 'whish' && <View style={[styles.checkDot, styles.checkDotWhish]} />}
            </TouchableOpacity>
          </View>

          {payMethod === 'whish' && (
            <View style={styles.whishInfo}>
              <Text style={styles.whishInfoTitle}>{t('checkout.whishHow')}</Text>
              <Text style={styles.whishStep}>{t('checkout.whishStep1')}</Text>
              <Text style={styles.whishStep}>{t('checkout.whishStep2')}</Text>
              <Text style={styles.whishStep}>{t('checkout.whishStep3')}</Text>
              <View style={styles.whishAmountBox}>
                <Text style={styles.whishAmountText}>💰 ${total}</Text>
              </View>
              <Text style={styles.whishStep}>{t('checkout.whishStep4')}</Text>
              <Text style={styles.whishStep}>{t('checkout.whishStep5')}</Text>
            </View>
          )}
        </View>

        {/* Note */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('checkout.noteSection')}</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder={t('checkout.notePlaceholder')}
            placeholderTextColor="#555"
            value={note}
            onChangeText={setNote}
            multiline
          />
        </View>

        {/* Bouton commande */}
        <TouchableOpacity
          style={[
            styles.orderBtn,
            payMethod === 'whish' && !isPreorder && styles.orderBtnWhish,
            isPreorder && styles.orderBtnPreorder,
            loading && styles.orderBtnLoading
          ]}
          onPress={placeOrder}
          disabled={loading}
        >
          <Text style={styles.orderBtnText}>
            {loading
              ? '⏳ Envoi en cours...'
              : isPreorder
                ? `⏰ Précommander — $${total}`
                : payMethod === 'whish'
                  ? `📱 ${t('checkout.orderBtnWhish')} — $${total}`
                  : `🛵 ${t('checkout.orderBtn')} — $${total}`}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  scroll: { padding: 20, paddingTop: 60 },
  back: { marginBottom: 20 },
  backText: { color: '#FF6B35', fontWeight: '600', fontSize: 15 },
  title: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 4 },
  restoName: { color: '#888', fontSize: 14, marginBottom: 24 },
  preorderBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1a1a2e', borderRadius: 14,
    padding: 16, marginBottom: 24,
    borderWidth: 1, borderColor: '#3a3a6a'
  },
  preorderEmoji: { fontSize: 28 },
  preorderTitle: { color: '#9a98ff', fontWeight: '700', fontSize: 15, marginBottom: 3 },
  preorderSub: { color: '#5a5a8a', fontSize: 13, lineHeight: 18 },
  section: { marginBottom: 28 },
  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 14 },
  itemsBox: { backgroundColor: '#1e1e1e', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 10 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBadge: { backgroundColor: '#FF6B35', borderRadius: 8, width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  qtyText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  itemName: { color: '#fff', fontSize: 14 },
  itemPrice: { color: '#FF6B35', fontWeight: '600' },
  itemOptions: { color: '#9C27B0', fontSize: 11, marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 6 },
  totalLabel: { color: '#888', fontSize: 14 },
  freeText: { color: '#4CAF50', fontWeight: 'bold', fontSize: 14 },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#2a2a2a', marginTop: 4 },
  grandLabel: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  grandAmount: { color: '#FF6B35', fontSize: 20, fontWeight: 'bold' },
  inputLabel: { color: '#888', fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 12 },
  inputMulti: { height: 85, textAlignVertical: 'top' },
  gpsBtn: { backgroundColor: '#0d2e1a', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#1a5c2e', alignItems: 'center', marginBottom: 8 },
  gpsBtnLoading: { opacity: 0.6 },
  gpsBtnText: { color: '#4CAF50', fontWeight: '700', fontSize: 14 },
  coordsBadge: { backgroundColor: '#0d2e1a', borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: '#1a5c2e' },
  coordsText: { color: '#4CAF50', fontSize: 11, textAlign: 'center' },
  payRow: { flexDirection: 'row', gap: 12 },
  payCard: { flex: 1, backgroundColor: '#1e1e1e', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: '#2a2a2a' },
  payCardCashActive: { borderColor: '#FF6B35', backgroundColor: '#2a1a10' },
  payCardWhishActive: { borderColor: '#6C3EE8', backgroundColor: '#1a1030' },
  payEmoji: { fontSize: 28, marginBottom: 6 },
  payLabel: { color: '#888', fontWeight: 'bold', fontSize: 15, marginBottom: 2 },
  payLabelCash: { color: '#FF6B35' },
  payLabelWhish: { color: '#6C3EE8' },
  paySub: { color: '#555', fontSize: 11 },
  checkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B35', marginTop: 8 },
  checkDotWhish: { backgroundColor: '#6C3EE8' },
  whishInfo: { marginTop: 14, backgroundColor: '#1a1030', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#6C3EE833' },
  whishInfoTitle: { color: '#9C7EE8', fontWeight: 'bold', fontSize: 14, marginBottom: 10 },
  whishStep: { color: '#aaa', fontSize: 13, marginBottom: 7, lineHeight: 20 },
  whishAmountBox: { backgroundColor: '#6C3EE822', borderRadius: 10, padding: 12, alignItems: 'center', marginVertical: 8, borderWidth: 1, borderColor: '#6C3EE8' },
  whishAmountText: { color: '#a07af0', fontWeight: 'bold', fontSize: 22 },
  orderBtn: { backgroundColor: '#FF6B35', borderRadius: 16, padding: 18, alignItems: 'center', shadowColor: '#FF6B35', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  orderBtnWhish: { backgroundColor: '#6C3EE8', shadowColor: '#6C3EE8' },
  orderBtnPreorder: { backgroundColor: '#4a48a0', shadowColor: '#4a48a0' },
  orderBtnLoading: { opacity: 0.7 },
  orderBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
})

