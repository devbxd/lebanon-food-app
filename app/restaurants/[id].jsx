import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Animated, Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { useTranslation } from '../../lib/LanguageContext'
import { supabase } from '../../lib/supabase'

const { height: SCREEN_H } = Dimensions.get('window')

export default function RestaurantScreen() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const [restaurant, setRestaurant] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [cart, setCart] = useState([])
  const [selectedOptions, setSelectedOptions] = useState({})
  const [activeCategory, setActiveCategory] = useState('Tout')
  const [search, setSearch] = useState('')

  const [sheetItem, setSheetItem] = useState(null)
  const [sheetVisible, setSheetVisible] = useState(false)
  const [sheetOptions, setSheetOptions] = useState([])
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setFetchError(null)
    const { data: resto, error: restoErr } = await supabase.from('restaurants').select('*').eq('id', id).single()
    const { data: menu } = await supabase.from('menu_items').select('*').eq('restaurant_id', id).eq('available', true)
    if (restoErr || !resto) { setFetchError('Restaurant introuvable ou erreur réseau'); setLoadingData(false); return }
    setRestaurant(resto)
    setMenuItems(menu || [])
    setLoadingData(false)
  }

 const isOpen = restaurant?.is_open === true || restaurant?.is_open === 'true'

  const categories = ['Tout', ...Array.from(new Set(menuItems.map(i => i.category).filter(Boolean)))]

  const filteredItems = menuItems.filter(item => {
    const matchCat = activeCategory === 'Tout' || item.category === activeCategory
    const matchSearch = search.trim() === '' ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

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
    const key = sheetItem.id + sheetOptions.map(o => o.name).join(',')
    const finalPrice = getSheetPrice()
    setCart(prev => {
      const existing = prev.find(i => i._key === key)
      if (existing) return prev.map(i => i._key === key ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...sheetItem, _key: key, selectedOptions: sheetOptions, price: finalPrice, qty: 1 }]
    })
    setSelectedOptions(prev => ({ ...prev, [sheetItem.id]: sheetOptions }))
    closeSheet()
  }

  function getQtyInCart(item) {
    const opts = selectedOptions[item.id] || []
    const key = item.id + opts.map(o => o.name).join(',')
    return cart.find(i => i._key === key)?.qty || 0
  }

  function quickRemove(item) {
    const opts = selectedOptions[item.id] || []
    const key = item.id + opts.map(o => o.name).join(',')
    setCart(prev => {
      const existing = prev.find(i => i._key === key)
      if (!existing) return prev
      if (existing.qty === 1) return prev.filter(i => i._key !== key)
      return prev.map(i => i._key === key ? { ...i, qty: i.qty - 1 } : i)
    })
  }

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0)

  function goToCheckout() {
    router.push({
      pathname: '/checkout',
      params: {
        cart: JSON.stringify(cart.map(({ _key, ...rest }) => rest)),
        restaurantId: id,
        restaurantName: restaurant.name,
        total: total.toFixed(2)
      }
    })
  }

  if (loadingData) return (
    <View style={styles.loading}>
      <View style={styles.skeletonHero} />
      <View style={{padding:16,gap:12}}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonSub} />
      </View>
    </View>
  )

  if (fetchError) return (
    <View style={styles.loading}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>
      <Text style={{fontSize:36,marginBottom:12}}>⚠️</Text>
      <Text style={{color:'#555',fontSize:15,textAlign:'center',marginBottom:20,paddingHorizontal:40}}>{fetchError}</Text>
      <TouchableOpacity onPress={fetchData} style={{backgroundColor:'#1c1c1c',borderRadius:14,paddingHorizontal:24,paddingVertical:12}}>
        <Text style={{color:'#FF6B35',fontWeight:'600'}}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  )

  if (!restaurant) return null

  return (
    <View style={styles.container}>

      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: restaurant.image_url }}
            style={[styles.heroImage, !isOpen && { opacity: 0.45 }]}
          />
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
                <View style={[styles.statusDot, !isOpen && styles.statusDotClosed]} />
                <Text style={[styles.statText, isOpen ? { color: '#4CAF50' } : { color: '#c05a5a' }]}>
                  {isOpen ? 'Ouvert' : 'Fermé'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bannière fermé avec option précommande */}
        {!isOpen && (
          <View style={styles.closedBanner}>
            <View style={styles.closedBannerLeft}>
              <Text style={styles.closedBannerEmoji}>🔴</Text>
              <View>
                <Text style={styles.closedBannerTitle}>Restaurant fermé</Text>
                <Text style={styles.closedBannerSub}>Tu peux quand même précommander !</Text>
              </View>
            </View>
            <View style={styles.preorderPill}>
              <Text style={styles.preorderPillText}>⏰ Préco</Text>
            </View>
          </View>
        )}

        {/* Barre de recherche */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un plat..."
            placeholderTextColor="#333"
            value={search}
            onChangeText={text => {
              setSearch(text)
              if (text.trim() !== '') setActiveCategory('Tout')
            }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Menu */}
        <View style={styles.menuSection}>

          {/* Catégories */}
          {categories.length > 1 && search.trim() === '' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={styles.catScroll}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
              {categories.map(cat => (
                <TouchableOpacity key={cat}
                  style={[styles.catTab, activeCategory === cat && styles.catTabActive]}
                  onPress={() => setActiveCategory(cat)} activeOpacity={0.7}>
                  <Text style={[styles.catTabText, activeCategory === cat && styles.catTabTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>
              {search.trim() !== '' ? `"${search}"` : activeCategory === 'Tout' ? 'Menu' : activeCategory}
            </Text>
            <Text style={styles.menuCount}>{filteredItems.length} articles</Text>
          </View>

          {filteredItems.length === 0 && (
            <View style={styles.emptyMenu}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>Aucun résultat</Text>
            </View>
          )}

          {filteredItems.map(item => {
            const qty = getQtyInCart(item)
            const hasOptions = item.options && item.options.length > 0

            return (
              <TouchableOpacity key={item.id}
                style={styles.menuCard}
                onPress={() => openSheet(item)}
                activeOpacity={0.85}>
                <View style={styles.menuRow}>
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

                  <View style={styles.menuInfo}>
                    <Text style={styles.menuName}>{item.name}</Text>
                    {item.description
                      ? <Text style={styles.menuDesc} numberOfLines={2}>{item.description}</Text>
                      : null}
                    <Text style={styles.menuPrice}>${Number(item.price).toFixed(2)}</Text>
                  </View>

                  <View style={styles.qtyControl}>
                    {qty > 0 ? (
                      <>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => quickRemove(item)}>
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

        <View style={{ height: 130 }} />
      </ScrollView>

      {/* Cart Bar — adapté si précommande */}
      {cartCount > 0 && (
        <TouchableOpacity
          style={[styles.cartBar, !isOpen && styles.cartBarPreorder]}
          onPress={goToCheckout}
          activeOpacity={0.9}>
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartCount}</Text>
          </View>
          <Text style={styles.cartText}>
            {isOpen ? 'Voir le panier' : '⏰ Précommander'}
          </Text>
          <Text style={styles.cartTotal}>${total.toFixed(2)}</Text>
        </TouchableOpacity>
      )}

      {/* Bottom Sheet */}
      <Modal visible={sheetVisible} transparent animationType="none" onRequestClose={closeSheet}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSheet} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {sheetItem && (
            <>
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
                contentContainerStyle={{ paddingBottom: 130 }}>

                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetName}>{sheetItem.name}</Text>
                    {sheetItem.description
                      ? <Text style={styles.sheetDesc}>{sheetItem.description}</Text>
                      : null}
                  </View>
                  <View style={styles.sheetPriceBox}>
                    <Text style={styles.sheetBaseLabel}>Prix</Text>
                    <Text style={styles.sheetBasePrice}>${Number(sheetItem.price).toFixed(2)}</Text>
                  </View>
                </View>

                {sheetItem.options && sheetItem.options.length > 0 && (
                  <View style={styles.sheetOptionsBlock}>
                    <View style={styles.sheetOptionsHeader}>
                      <Text style={styles.sheetOptionsTitle}>Personnalisations</Text>
                      <Text style={styles.sheetOptionsSub}>
                        {sheetItem.options.some(o => o.required) ? 'Certains requis' : 'Tous optionnels'}
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
                            {opt.required && <Text style={styles.sheetOptionReqTag}>Requis</Text>}
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

              <View style={styles.sheetFooter}>
                <View style={styles.sheetTotalRow}>
                  <Text style={styles.sheetTotalLabel}>Total</Text>
                  <Text style={styles.sheetTotalPrice}>${getSheetPrice().toFixed(2)}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.sheetAddBtn, !isOpen && styles.sheetAddBtnPreorder]}
                  onPress={addSheetToCart} activeOpacity={0.9}>
                  <Text style={styles.sheetAddBtnText}>
                    {isOpen ? 'Ajouter au panier' : '⏰ Ajouter à la précommande'}
                  </Text>
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
  container: { flex: 1, backgroundColor: '#0e0e0e' },
  loading: { flex: 1, backgroundColor: '#0e0e0e', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#444', fontSize: 14 },

  backBtn: {
    position: 'absolute', top: 54, left: 16, zIndex: 99,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    width: 40, height: 40, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  backText: { color: '#fff', fontSize: 20 },

  // Hero
  heroContainer: { height: 280, position: 'relative' },
  heroImage: { width: '100%', height: 280 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  heroContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 24 },
  heroCategoryPill: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,107,53,0.2)',
    borderWidth: 1, borderColor: 'rgba(255,107,53,0.4)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  heroCategoryText: { color: '#FF6B35', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  heroName: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  heroDesc: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 14, lineHeight: 18 },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '500' },
  statDivider: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 10 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
  statusDotClosed: { backgroundColor: '#c05a5a' },

  // Bannière fermé
  closedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1a0e0e', borderBottomWidth: 1, borderBottomColor: '#2e1414',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  closedBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  closedBannerEmoji: { fontSize: 20 },
  closedBannerTitle: { color: '#c05a5a', fontSize: 14, fontWeight: '700' },
  closedBannerSub: { color: '#5a3a3a', fontSize: 12, marginTop: 2 },
  preorderPill: {
    backgroundColor: '#1a1a2e', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#3a3a6a',
  },
  preorderPillText: { color: '#7a78cf', fontSize: 12, fontWeight: '700' },

  // Recherche
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 16, marginBottom: 4,
    backgroundColor: '#141414', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: '#1e1e1e',
  },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },
  searchClear: { color: '#333', fontSize: 15, paddingLeft: 4 },

  // Menu
  menuSection: { backgroundColor: '#0e0e0e', paddingTop: 12 },
  catScroll: { marginBottom: 4 },
  catTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#141414', borderWidth: 1, borderColor: '#1e1e1e',
  },
  catTabActive: { backgroundColor: '#FF6B3512', borderColor: '#FF6B3540' },
  catTabText: { color: '#444', fontSize: 13, fontWeight: '600' },
  catTabTextActive: { color: '#FF6B35' },
  menuHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  menuTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  menuCount: { color: '#333', fontSize: 12 },
  emptyMenu: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 36, marginBottom: 12 },
  emptyText: { color: '#333', fontSize: 14 },

  menuCard: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#141414', borderRadius: 14,
    borderWidth: 1, borderColor: '#1e1e1e',
  },
  menuRow: { flexDirection: 'row', padding: 12, gap: 12, alignItems: 'center' },
  menuImageWrap: { position: 'relative' },
  menuImg: { width: 76, height: 76, borderRadius: 10 },
  menuImgPlaceholder: {
    width: 76, height: 76, borderRadius: 10,
    backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center',
  },
  optionsBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(255,107,53,0.85)',
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    alignItems: 'center', paddingVertical: 2,
  },
  optionsBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  menuInfo: { flex: 1 },
  menuName: { color: '#e8e8e8', fontWeight: '700', fontSize: 14, marginBottom: 3 },
  menuDesc: { color: '#3a3a3a', fontSize: 12, lineHeight: 17, marginBottom: 6 },
  menuPrice: { color: '#FF6B35', fontWeight: '800', fontSize: 15 },

  qtyControl: { justifyContent: 'center', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center',
  },
  qtyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  qtyNum: { color: '#fff', fontWeight: '800', fontSize: 14, minWidth: 20, textAlign: 'center' },
  addBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  skeletonHero: { width: '100%', height: 280, backgroundColor: '#1c1c1c' },
  skeletonTitle: { height: 18, backgroundColor: '#1c1c1c', borderRadius: 9, width: '60%' },
  skeletonSub: { height: 12, backgroundColor: '#161616', borderRadius: 6, width: '80%' },

  // Cart bar
  cartBar: {
    position: 'absolute', bottom: 28, left: 16, right: 16,
    backgroundColor: '#FF6B35', borderRadius: 16,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 15,
    shadowColor: '#FF6B35', shadowOpacity: 0.35, shadowRadius: 12, elevation: 10,
  },
  cartBarPreorder: { backgroundColor: '#4a48a0', shadowColor: '#4a48a0' },
  cartBadge: {
    backgroundColor: '#fff', borderRadius: 10,
    width: 26, height: 26, justifyContent: 'center', alignItems: 'center',
  },
  cartBadgeText: { color: '#FF6B35', fontWeight: '800', fontSize: 12 },
  cartText: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 15, textAlign: 'center' },
  cartTotal: { color: '#fff', fontWeight: '800', fontSize: 15 },

  overlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)' },

  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#141414',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: SCREEN_H * 0.92,
    borderTopWidth: 1, borderTopColor: '#1e1e1e', overflow: 'hidden',
  },
  sheetImageWrap: { height: 210, position: 'relative' },
  sheetImage: { width: '100%', height: 210 },
  sheetImagePlaceholder: {
    width: '100%', height: 210, backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center',
  },
  sheetImageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  sheetCloseBtn: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 18,
    width: 34, height: 34, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetCloseTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sheetCatBadge: {
    position: 'absolute', bottom: 14, left: 14,
    backgroundColor: 'rgba(255,107,53,0.2)',
    borderWidth: 1, borderColor: 'rgba(255,107,53,0.4)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  sheetCatText: { color: '#FF6B35', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  sheetScroll: { flex: 1 },
  sheetHeader: { flexDirection: 'row', padding: 20, paddingBottom: 16, gap: 14, alignItems: 'flex-start' },
  sheetName: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginBottom: 6 },
  sheetDesc: { color: '#555', fontSize: 13, lineHeight: 19 },
  sheetPriceBox: { alignItems: 'flex-end', paddingTop: 2 },
  sheetBaseLabel: { color: '#333', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  sheetBasePrice: { color: '#FF6B35', fontSize: 22, fontWeight: '800' },
  sheetOptionsBlock: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: '#1a1a1a', borderRadius: 14,
    overflow: 'hidden', borderWidth: 1, borderColor: '#222',
  },
  sheetOptionsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1e1e1e', backgroundColor: '#141414',
  },
  sheetOptionsTitle: { color: '#aaa', fontSize: 13, fontWeight: '700' },
  sheetOptionsSub: { color: '#333', fontSize: 11 },
  sheetOptionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  sheetOptionRowChecked: { backgroundColor: '#FF6B3506' },
  sheetOptionCheck: {
    width: 22, height: 22, borderRadius: 7,
    borderWidth: 1.5, borderColor: '#2a2a2a',
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#0e0e0e',
  },
  sheetOptionCheckChecked: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  sheetOptionCheckMark: { color: '#fff', fontSize: 12, fontWeight: '800' },
  sheetOptionInfo: { flex: 1 },
  sheetOptionName: { color: '#666', fontSize: 14, fontWeight: '500' },
  sheetOptionNameChecked: { color: '#fff', fontWeight: '600' },
  sheetOptionReqTag: { color: '#FF6B35', fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  sheetOptionPricePill: {
    backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#252525',
  },
  sheetOptionPricePillChecked: { backgroundColor: '#FF6B3515', borderColor: '#FF6B3540' },
  sheetOptionPrice: { color: '#444', fontSize: 13, fontWeight: '600' },
  sheetOptionPriceChecked: { color: '#FF6B35' },
  sheetFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#141414', paddingHorizontal: 20, paddingBottom: 34, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: '#1e1e1e',
  },
  sheetTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTotalLabel: { color: '#444', fontSize: 13 },
  sheetTotalPrice: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sheetAddBtn: {
    backgroundColor: '#FF6B35', borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, paddingHorizontal: 20, gap: 12,
  },
  sheetAddBtnPreorder: { backgroundColor: '#4a48a0' },
  sheetAddBtnText: { color: '#fff', fontWeight: '800', fontSize: 15, flex: 1, textAlign: 'center' },
  sheetAddPriceBadge: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  sheetAddPriceBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
})

