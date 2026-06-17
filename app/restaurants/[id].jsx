import { useEffect, useState, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  Image, StyleSheet, Animated, Dimensions, Modal
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useTranslation } from '../../lib/LanguageContext'

const { height: SCREEN_H } = Dimensions.get('window')

export default function RestaurantScreen() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const [restaurant, setRestaurant] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [cart, setCart] = useState([])
  const [selectedOptions, setSelectedOptions] = useState({})
  const [activeCategory, setActiveCategory] = useState('Tout')

  // Bottom sheet
  const [sheetItem, setSheetItem] = useState(null)
  const [sheetVisible, setSheetVisible] = useState(false)
  const [sheetOptions, setSheetOptions] = useState([])
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: resto } = await supabase.from('restaurants').select('*').eq('id', id).single()
    const { data: menu } = await supabase.from('menu_items').select('*').eq('restaurant_id', id).eq('available', true)
    if (resto) setRestaurant(resto)
    if (menu) setMenuItems(menu)
  }

  const categories = ['Tout', ...Array.from(new Set(menuItems.map(i => i.category).filter(Boolean)))]
  const filteredItems = activeCategory === 'Tout' ? menuItems : menuItems.filter(i => i.category === activeCategory)

  // ── Bottom sheet ──
  function openSheet(item) {
    setSheetItem(item)
    setSheetOptions(selectedOptions[item.id] ? [...selectedOptions[item.id]] : [])
    setSheetVisible(true)
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start()
  }

  function closeSheet() {
    Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 260, useNativeDriver: true }).start(() => {
      setSheetVisible(false)
      setSheetItem(null)
    })
  }

  function toggleSheetOption(option) {
    setSheetOptions(prev => {
      const exists = prev.find(o => o.name === option.name)
      return exists ? prev.filter(o => o.name !== option.name) : [...prev, option]
    })
  }

  function getSheetPrice() {
    if (!sheetItem) return 0
    return sheetItem.price + sheetOptions.reduce((s, o) => s + (o.price || 0), 0)
  }

  function addSheetToCart() {
    if (!sheetItem) return
    const opts = sheetOptions
    const key = sheetItem.id + opts.map(o => o.name).join(',')
    const finalPrice = getSheetPrice()
    setCart(prev => {
      const existing = prev.find(i => i._key === key)
      if (existing) return prev.map(i => i._key === key ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...sheetItem, _key: key, selectedOptions: opts, price: finalPrice, qty: 1 }]
    })
    // save options back to global state
    setSelectedOptions(prev => ({ ...prev, [sheetItem.id]: opts }))
    closeSheet()
  }

  // ── Cart helpers ──
  function getQtyInCart(item) {
    const opts = selectedOptions[item.id] || []
    const key = item.id + opts.map(o => o.name).join(',')
    return cart.find(i => i._key === key)?.qty || 0
  }

  function quickRemove(item, e) {
    e?.stopPropagation?.()
    const opts = selectedOptions[item.id] || []
    const key = item.id + opts.map(o => o.name).join(',')
    setCart(prev => {
      const existing = prev.find(i => i._key === key)
      if (!existing) return prev
      if (existing.qty === 1) return prev.filter(i => i._key !== key)
      return prev.map(i => i._key === key ? { ...i, qty: i.qty - 1 } : i)
    })
  }

  function getCartForCheckout() {
    return cart.map(({ _key, ...rest }) => rest)
  }

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0)

  if (!restaurant) return (
    <View style={styles.loading}>
      <Text style={styles.loadingText}>{t('common.loading')}</Text>
    </View>
  )

  return (
    <View style={styles.container}>

      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.heroContainer}>
          <Image source={{ uri: restaurant.image_url }} style={styles.heroImage} />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <View style={styles.heroCategoryPill}>
              <Text style={styles.heroCategoryText}>{restaurant.category}</Text>
            </View>
            <Text style={styles.heroName}>{restaurant.name}</Text>
            <Text style={styles.heroDesc}>{restaurant.description}</Text>
            <View style={styles.heroStats}>
              <View style={styles.statItem}>
                <Text style={styles.statText}>⏱ {restaurant.delivery_time}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statText}>💵 Min ${restaurant.min_order}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={styles.openDot} />
                <Text style={[styles.statText, { color: '#4CAF50' }]}>{t('home.openNow')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menuSection}>

          {/* Categories */}
          {categories.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={styles.catScroll} contentContainerStyle={styles.catScrollContent}>
              {categories.map(cat => (
                <TouchableOpacity key={cat}
                  style={[styles.catTab, activeCategory === cat && styles.catTabActive]}
                  onPress={() => setActiveCategory(cat)} activeOpacity={0.7}>
                  <Text style={[styles.catTabText, activeCategory === cat && styles.catTabTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>{t('restaurant.menu')}</Text>
            <Text style={styles.menuCount}>{filteredItems.length} articles</Text>
          </View>

          {filteredItems.length === 0 && (
            <View style={styles.emptyMenu}>
              <Text style={styles.emptyEmoji}>🍽</Text>
              <Text style={styles.emptyText}>{t('restaurant.noItems')}</Text>
            </View>
          )}

          {/* Item cards — tap to open sheet */}
          {filteredItems.map(item => {
            const qty = getQtyInCart(item)
            const hasOptions = item.options && item.options.length > 0

            return (
              <TouchableOpacity key={item.id} style={styles.menuCard}
                onPress={() => openSheet(item)} activeOpacity={0.85}>
                <View style={styles.menuRow}>

                  {/* Image */}
                  <View style={styles.menuImageWrap}>
                    {item.image_url
                      ? <Image source={{ uri: item.image_url }} style={styles.menuImg} />
                      : <View style={styles.menuImgPlaceholder}><Text style={{ fontSize: 26 }}>🍴</Text></View>
                    }
                    {hasOptions && (
                      <View style={styles.optionsBadge}>
                        <Text style={styles.optionsBadgeText}>Options</Text>
                      </View>
                    )}
                  </View>

                  {/* Info */}
                  <View style={styles.menuInfo}>
                    <Text style={styles.menuName}>{item.name}</Text>
                    {item.description
                      ? <Text style={styles.menuDesc} numberOfLines={2}>{item.description}</Text>
                      : null}
                    <Text style={styles.menuPrice}>${Number(item.price).toFixed(2)}</Text>
                  </View>

                  {/* Qty / Add */}
                  <View style={styles.qtyControl}>
                    {qty > 0 ? (
                      <>
                        <TouchableOpacity style={styles.qtyBtn} onPress={(e) => quickRemove(item, e)}>
                          <Text style={styles.qtyBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.qtyNum}>{qty}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => openSheet(item)}>
                          <Text style={styles.qtyBtnText}>+</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity style={styles.addBtn} onPress={() => openSheet(item)}>
                        <Text style={styles.addBtnText}>+</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Cart Bar */}
      {cartCount > 0 && (
        <TouchableOpacity style={styles.cartBar}
          onPress={() => router.push({ pathname: '/checkout', params: {
            cart: JSON.stringify(getCartForCheckout()),
            restaurantId: id,
            restaurantName: restaurant.name,
            total: total.toFixed(2)
          }})} activeOpacity={0.9}>
          <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>
          <Text style={styles.cartText}>{t('restaurant.viewCart')}</Text>
          <Text style={styles.cartTotal}>${total.toFixed(2)}</Text>
        </TouchableOpacity>
      )}

      {/* ── Bottom Sheet ── */}
      <Modal visible={sheetVisible} transparent animationType="none" onRequestClose={closeSheet}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSheet} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {sheetItem && (
            <>
              {/* Image */}
              <View style={styles.sheetImageWrap}>
                {sheetItem.image_url
                  ? <Image source={{ uri: sheetItem.image_url }} style={styles.sheetImage} />
                  : <View style={styles.sheetImagePlaceholder}><Text style={{ fontSize: 48 }}>🍴</Text></View>
                }
                <View style={styles.sheetImageOverlay} />
                <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeSheet}>
                  <Text style={styles.sheetCloseTxt}>✕</Text>
                </TouchableOpacity>
                {sheetItem.category && (
                  <View style={styles.sheetCatBadge}>
                    <Text style={styles.sheetCatText}>{sheetItem.category}</Text>
                  </View>
                )}
              </View>

              <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}>

                {/* Name + price */}
                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetName}>{sheetItem.name}</Text>
                    {sheetItem.description ? (
                      <Text style={styles.sheetDesc}>{sheetItem.description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.sheetPriceBox}>
                    <Text style={styles.sheetBaseLabel}>Prix</Text>
                    <Text style={styles.sheetBasePrice}>${Number(sheetItem.price).toFixed(2)}</Text>
                  </View>
                </View>

                {/* Options */}
                {sheetItem.options && sheetItem.options.length > 0 && (
                  <View style={styles.sheetOptionsBlock}>
                    <View style={styles.sheetOptionsHeader}>
                      <Text style={styles.sheetOptionsTitle}>Personnalisations</Text>
                      <Text style={styles.sheetOptionsSub}>
                        {sheetItem.options.filter(o => o.required).length > 0
                          ? 'Certains choix sont requis'
                          : 'Tous optionnels'}
                      </Text>
                    </View>

                    {sheetItem.options.map((opt, i) => {
                      const checked = !!sheetOptions.find(o => o.name === opt.name)
                      return (
                        <TouchableOpacity key={i}
                          style={[styles.sheetOptionRow, checked && styles.sheetOptionRowChecked]}
                          onPress={() => toggleSheetOption(opt)} activeOpacity={0.75}>

                          <View style={[styles.sheetOptionCheck, checked && styles.sheetOptionCheckChecked]}>
                            {checked && <Text style={styles.sheetOptionCheckMark}>✓</Text>}
                          </View>

                          <View style={styles.sheetOptionInfo}>
                            <Text style={[styles.sheetOptionName, checked && styles.sheetOptionNameChecked]}>
                              {opt.name}
                            </Text>
                            {opt.required && (
                              <Text style={styles.sheetOptionReqTag}>Requis</Text>
                            )}
                          </View>

                          <View style={[styles.sheetOptionPricePill, checked && styles.sheetOptionPricePillChecked]}>
                            <Text style={[styles.sheetOptionPrice, checked && styles.sheetOptionPriceChecked]}>
                              {opt.price > 0 ? `+$${Number(opt.price).toFixed(2)}` : 'Gratuit'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
              </ScrollView>

              {/* Add to cart footer */}
              <View style={styles.sheetFooter}>
                <View style={styles.sheetTotalRow}>
                  <Text style={styles.sheetTotalLabel}>Total</Text>
                  <Text style={styles.sheetTotalPrice}>${getSheetPrice().toFixed(2)}</Text>
                </View>
                <TouchableOpacity style={styles.sheetAddBtn} onPress={addSheetToCart} activeOpacity={0.9}>
                  <Text style={styles.sheetAddBtnText}>Ajouter au panier</Text>
                  <View style={styles.sheetAddPriceBadge}>
                    <Text style={styles.sheetAddPriceBadgeText}>${getSheetPrice().toFixed(2)}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  loading: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#555', fontSize: 14 },

  backBtn: {
    position: 'absolute', top: 54, left: 16, zIndex: 99,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20,
    width: 40, height: 40, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  backText: { color: '#fff', fontSize: 20 },

  // Hero
  heroContainer: { height: 290, position: 'relative' },
  heroImage: { width: '100%', height: 290 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.52)' },
  heroContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 26 },
  heroCategoryPill: {
    alignSelf: 'flex-start', backgroundColor: '#FF6B3530',
    borderWidth: 1, borderColor: '#FF6B3560', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  heroCategoryText: { color: '#FF6B35', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  heroName: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  heroDesc: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginBottom: 14, lineHeight: 18 },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500' },
  statDivider: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 10 },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },

  // Menu section
  menuSection: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -22, paddingTop: 20 },
  catScroll: { marginBottom: 4 },
  catScrollContent: { paddingHorizontal: 16, gap: 8 },
  catTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#252525',
  },
  catTabActive: { backgroundColor: '#FF6B3515', borderColor: '#FF6B3555' },
  catTabText: { color: '#555', fontSize: 13, fontWeight: '600' },
  catTabTextActive: { color: '#FF6B35' },
  menuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  menuTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  menuCount: { color: '#444', fontSize: 12 },
  emptyMenu: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyText: { color: '#444', fontSize: 15 },

  // Menu card (compact, no options shown)
  menuCard: {
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: '#1a1a1a', borderRadius: 16,
    borderWidth: 1, borderColor: '#242424',
  },
  menuRow: { flexDirection: 'row', padding: 12, gap: 12, alignItems: 'center' },
  menuImageWrap: { position: 'relative' },
  menuImg: { width: 80, height: 80, borderRadius: 12 },
  menuImgPlaceholder: {
    width: 80, height: 80, borderRadius: 12,
    backgroundColor: '#222', justifyContent: 'center', alignItems: 'center',
  },
  optionsBadge: {
    position: 'absolute', bottom: -1, left: 0, right: 0,
    backgroundColor: 'rgba(255,107,53,0.85)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    alignItems: 'center', paddingVertical: 2,
  },
  optionsBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  menuInfo: { flex: 1 },
  menuName: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 4, letterSpacing: -0.2 },
  menuDesc: { color: '#555', fontSize: 12, lineHeight: 17, marginBottom: 6 },
  menuPrice: { color: '#FF6B35', fontWeight: '800', fontSize: 16 },
  qtyControl: { justifyContent: 'center', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center',
  },
  qtyBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  qtyNum: { color: '#fff', fontWeight: '800', fontSize: 15, minWidth: 20, textAlign: 'center' },
  addBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#FF6B35', shadowOpacity: 0.35, shadowRadius: 6, elevation: 4,
  },
  addBtnText: { color: '#fff', fontSize: 22, fontWeight: '700' },

  // Cart bar
  cartBar: {
    position: 'absolute', bottom: 30, left: 16, right: 16,
    backgroundColor: '#FF6B35', borderRadius: 18,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
    shadowColor: '#FF6B35', shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
  },
  cartBadge: { backgroundColor: '#fff', borderRadius: 12, width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { color: '#FF6B35', fontWeight: '800', fontSize: 13 },
  cartText: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 16, textAlign: 'center' },
  cartTotal: { color: '#fff', fontWeight: '800', fontSize: 16 },

  // Overlay
  overlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.72)' },

  // Bottom sheet
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#141414',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    maxHeight: SCREEN_H * 0.92,
    borderTopWidth: 1, borderTopColor: '#242424',
    overflow: 'hidden',
  },

  // Sheet image
  sheetImageWrap: { height: 220, position: 'relative' },
  sheetImage: { width: '100%', height: 220 },
  sheetImagePlaceholder: { width: '100%', height: 220, backgroundColor: '#1e1e1e', justifyContent: 'center', alignItems: 'center' },
  sheetImageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheetCloseBtn: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 18,
    width: 34, height: 34, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetCloseTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sheetCatBadge: {
    position: 'absolute', bottom: 14, left: 14,
    backgroundColor: '#FF6B3530', borderWidth: 1, borderColor: '#FF6B3560',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  sheetCatText: { color: '#FF6B35', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  sheetScroll: { flex: 1 },

  // Sheet header
  sheetHeader: { flexDirection: 'row', padding: 20, paddingBottom: 16, gap: 14, alignItems: 'flex-start' },
  sheetName: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: 6 },
  sheetDesc: { color: '#777', fontSize: 13, lineHeight: 19 },
  sheetPriceBox: { alignItems: 'flex-end', paddingTop: 2 },
  sheetBaseLabel: { color: '#444', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  sheetBasePrice: { color: '#FF6B35', fontSize: 22, fontWeight: '800' },

  // Sheet options
  sheetOptionsBlock: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#1a1a1a', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#242424' },
  sheetOptionsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#222',
    backgroundColor: '#161616',
  },
  sheetOptionsTitle: { color: '#ccc', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  sheetOptionsSub: { color: '#444', fontSize: 11 },

  sheetOptionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
  },
  sheetOptionRowChecked: { backgroundColor: '#FF6B3508' },

  sheetOptionCheck: {
    width: 22, height: 22, borderRadius: 7,
    borderWidth: 1.5, borderColor: '#333',
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#111',
  },
  sheetOptionCheckChecked: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  sheetOptionCheckMark: { color: '#fff', fontSize: 12, fontWeight: '800' },

  sheetOptionInfo: { flex: 1 },
  sheetOptionName: { color: '#888', fontSize: 14, fontWeight: '500' },
  sheetOptionNameChecked: { color: '#fff', fontWeight: '600' },
  sheetOptionReqTag: {
    color: '#FF6B35', fontSize: 10, fontWeight: '600',
    marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3,
  },

  sheetOptionPricePill: {
    backgroundColor: '#222', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#2e2e2e',
  },
  sheetOptionPricePillChecked: { backgroundColor: '#FF6B3520', borderColor: '#FF6B3545' },
  sheetOptionPrice: { color: '#555', fontSize: 13, fontWeight: '600' },
  sheetOptionPriceChecked: { color: '#FF6B35' },

  // Sheet footer
  sheetFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#141414', paddingHorizontal: 20, paddingBottom: 36, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: '#1e1e1e',
  },
  sheetTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTotalLabel: { color: '#555', fontSize: 13 },
  sheetTotalPrice: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sheetAddBtn: {
    backgroundColor: '#FF6B35', borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 20, gap: 12,
    shadowColor: '#FF6B35', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  sheetAddBtnText: { color: '#fff', fontWeight: '800', fontSize: 16, flex: 1, textAlign: 'center' },
  sheetAddPriceBadge: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  sheetAddPriceBadgeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
})

