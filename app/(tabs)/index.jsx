import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { useTranslation } from '../../lib/LanguageContext'
import { supabase } from '../../lib/supabase'

const { width } = Dimensions.get('window')

const CATEGORIES = ['Tout', 'Burgers', 'Shawarma', 'Pizza', 'Healthy', 'Sushi', 'Grillades']
const CAT_ICONS = {
  'Tout': '🍽️', 'Burgers': '🍔', 'Shawarma': '🌯',
  'Pizza': '🍕', 'Healthy': '🥗', 'Sushi': '🍣', 'Grillades': '🥩',
}

const ORANGE = '#FF6B35'
const BG = '#0a0a0a'
const CARD = '#131313'
const BORDER = '#1c1c1c'
const WHITE = '#ffffff'

function SkeletonCard({ wide }) {
  const shimmer = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
    ])).start()
  }, [])
  const opacity = shimmer.interpolate({ inputRange: [0,1], outputRange: [0.3,0.6] })
  if (wide) return (
    <Animated.View style={[sk.featCard, { opacity }]}>
      <View style={sk.featImg} /><View style={sk.featBody}><View style={sk.titleBar} /><View style={sk.subBar} /></View>
    </Animated.View>
  )
  return (
    <Animated.View style={[sk.compCard, { opacity }]}>
      <View style={sk.compImg} /><View style={sk.compBody}><View style={sk.titleBar} /><View style={sk.subBar} /></View>
    </Animated.View>
  )
}
const sk = StyleSheet.create({
  featCard: { marginHorizontal:16, marginBottom:16, borderRadius:24, backgroundColor:'#131313', overflow:'hidden', height:280 },
  featImg: { width:'100%', height:220, backgroundColor:'#1c1c1c' },
  featBody: { padding:16, gap:10 },
  compCard: { flexDirection:'row', marginHorizontal:16, marginBottom:10, borderRadius:18, backgroundColor:'#131313', overflow:'hidden', height:96 },
  compImg: { width:96, height:96, backgroundColor:'#1c1c1c' },
  compBody: { flex:1, padding:12, gap:10, justifyContent:'center' },
  titleBar: { height:12, backgroundColor:'#222', borderRadius:6, width:'70%' },
  subBar: { height:10, backgroundColor:'#1a1a1a', borderRadius:5, width:'50%' },
})

export default function HomeScreen() {
  const { t } = useTranslation()
  const [restaurants, setRestaurants] = useState([])
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('Tout')
  const [location, setLocation] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const router = useRouter()

  const headerFade = useRef(new Animated.Value(0)).current
  const headerSlide = useRef(new Animated.Value(-20)).current

  useEffect(() => {
    fetchRestaurants()
    getLocation()
    getUser()

    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start()

    const channelName = `restaurants-open-status-${Date.now()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurants' }, () => {
        fetchRestaurants()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function getUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUser(user)
  }

  async function getLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return
    const loc = await Location.getCurrentPositionAsync({})
    const address = await Location.reverseGeocodeAsync(loc.coords)
    if (address[0]) setLocation(`${address[0].city || address[0].district || ''}`)
  }

  async function fetchRestaurants() {
    setFetchError(null)
    const { data, error } = await supabase.from('restaurants').select('*')
    if (error) { setFetchError('Impossible de charger les restaurants'); setLoading(false); return }
    if (data) setRestaurants(data)
    setLoading(false)
  }

  function getCatLabel(cat) {
    return cat === 'Tout' ? t('home.allCategories') : cat
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || null

  const filtered = restaurants.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = selectedCat === 'Tout' || r.category?.toLowerCase() === selectedCat.toLowerCase()
    return matchSearch && matchCat
  })

  const featured = filtered.slice(0, 2)
  const rest = filtered.slice(2)

  function RestoFeaturedCard({ resto }) {
    const isOpen = resto.is_open === true || resto.is_open === 'true'
    return (
      <TouchableOpacity
        style={s.featCard}
        onPress={() => router.push(`/restaurants/${resto.id}`)}
        activeOpacity={0.92}
      >
        <Image source={{ uri: resto.image_url }} style={[s.featImg, !isOpen && s.imgDim]} />
        {/* gradient overlay */}
        <View style={s.featGradient} />

        {/* top badges */}
        <View style={s.featTopRow}>
          <View style={s.catTag}>
            <Text style={s.catTagTxt}>{CAT_ICONS[resto.category] || '🍽️'}  {resto.category}</Text>
          </View>
          <View style={[s.statusTag, isOpen ? s.statusOpen : s.statusClosed]}>
            <View style={[s.statusDot, { backgroundColor: isOpen ? '#4CAF50' : '#9a98ff' }]} />
            <Text style={[s.statusTxt, { color: isOpen ? '#4CAF50' : '#9a98ff' }]}>
              {isOpen ? t('home.openNow') : '⏰ Précommande'}
            </Text>
          </View>
        </View>

        {/* bottom info */}
        <View style={s.featBottom}>
          <Text style={s.featName}>{resto.name}</Text>
          <Text style={s.featDesc} numberOfLines={1}>{resto.description}</Text>
          {isOpen ? (
            <View style={s.featMetaRow}>
              <View style={s.metaChip}><Text style={s.metaChipTxt}>⏱  {resto.delivery_time}</Text></View>
              <View style={s.metaChip}><Text style={s.metaChipTxt}>💵  Min ${resto.min_order}</Text></View>
            </View>
          ) : (
            <View style={s.featMetaRow}>
              <View style={[s.metaChip, s.metaChipPreorder]}>
                <Text style={s.metaChipPreorderTxt}>Commandez à l'avance</Text>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  function RestoCompactCard({ resto }) {
    const isOpen = resto.is_open === true || resto.is_open === 'true'
    return (
      <TouchableOpacity
        style={s.compCard}
        onPress={() => router.push(`/restaurants/${resto.id}`)}
        activeOpacity={0.85}
      >
        <View style={s.compImgWrap}>
          <Image source={{ uri: resto.image_url }} style={[s.compImg, !isOpen && s.imgDim]} />
          {!isOpen && (
            <View style={s.compImgOverlay}>
              <Text style={{ fontSize: 18 }}>⏰</Text>
            </View>
          )}
        </View>
        <View style={s.compBody}>
          <View style={s.compTopRow}>
            <Text style={s.compName} numberOfLines={1}>{resto.name}</Text>
            <View style={s.compCatBadge}>
              <Text style={{ fontSize: 13 }}>{CAT_ICONS[resto.category] || '🍽️'}</Text>
            </View>
          </View>
          <Text style={s.compDesc} numberOfLines={1}>{resto.description}</Text>
          <View style={s.compMeta}>
            {isOpen ? (
              <>
                <Text style={s.compMetaTxt}>⏱  {resto.delivery_time}</Text>
                <Text style={s.compMetaDot}>·</Text>
                <Text style={s.compMetaTxt}>💵  Min ${resto.min_order}</Text>
                <Text style={s.compMetaDot}>·</Text>
                <View style={s.openDotRow}>
                  <View style={[s.dot, { backgroundColor: '#4CAF50' }]} />
                  <Text style={[s.compMetaTxt, { color: '#4CAF50' }]}>Ouvert</Text>
                </View>
              </>
            ) : (
              <View style={s.openDotRow}>
                <View style={[s.dot, { backgroundColor: '#9a98ff' }]} />
                <Text style={[s.compMetaTxt, { color: '#9a98ff' }]}>Précommande</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>

        {/* ── Header ── */}
        <Animated.View style={[s.header, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
          <View style={s.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.greeting}>
                {firstName ? `Salut ${firstName} 👋` : 'Bonsoir 👋'}
              </Text>
              <Text style={s.heroTitle}>Qu'est-ce qui{'\n'}te fait envie ?</Text>
            </View>
            {location && (
              <View style={s.locPill}>
                <Text style={s.locPin}>📍</Text>
                <Text style={s.locTxt} numberOfLines={1}>{location}</Text>
              </View>
            )}
          </View>

          {/* Search */}
          <View style={s.searchBar}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              style={s.searchInput}
              placeholder={t('home.searchPlaceholder')}
              placeholderTextColor="#3a3a3a"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={s.clearBtn}>
                <Text style={s.clearTxt}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* ── Categories ── */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={s.catScroll}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6 }}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[s.catChip, selectedCat === cat && s.catChipActive]}
              onPress={() => setSelectedCat(cat)}
              activeOpacity={0.7}
            >
              <Text style={s.catEmoji}>{CAT_ICONS[cat]}</Text>
              <Text style={[s.catTxt, selectedCat === cat && s.catTxtActive]}>
                {getCatLabel(cat)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Loading skeletons ── */}
        {loading && (
          <View>
            <SkeletonCard wide />
            <SkeletonCard wide />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        )}

        {/* ── Error state ── */}
        {!loading && fetchError && (
          <View style={s.errorBox}>
            <Text style={s.errorEmoji}>⚠️</Text>
            <Text style={s.errorTitle}>{fetchError}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={fetchRestaurants}>
              <Text style={s.retryTxt}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Empty state ── */}
        {!loading && !fetchError && filtered.length === 0 && (
          <View style={s.emptyBox}>
            <Text style={s.emptyEmoji}>🍽️</Text>
            <Text style={s.emptyTitle}>{t('home.noRestaurants')}</Text>
            <Text style={s.emptySub}>Essaie une autre catégorie</Text>
          </View>
        )}

        {/* ── Featured ── */}
        {!loading && !fetchError && featured.length > 0 && (
          <>
            <View style={s.secRow}>
              <Text style={s.secTitle}>
                {selectedCat === 'Tout' ? '⭐  À la une' : `${CAT_ICONS[selectedCat]}  ${getCatLabel(selectedCat)}`}
              </Text>
              {filtered.length > 0 && (
                <View style={s.countBadge}>
                  <Text style={s.countTxt}>{filtered.length} restos</Text>
                </View>
              )}
            </View>
            {featured.map(r => <RestoFeaturedCard key={r.id} resto={r} />)}
          </>
        )}

        {/* ── Rest ── */}
        {!loading && !fetchError && rest.length > 0 && (
          <>
            <View style={s.secRow}>
              <Text style={s.secTitle}>🔥  Autres restos</Text>
            </View>
            {rest.map(r => <RestoCompactCard key={r.id} resto={r} />)}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: BG },

  // Header
  header:         { backgroundColor: '#0f0f0f', paddingTop: 62, paddingHorizontal: 20, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: BORDER },
  headerTopRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  greeting:       { color: '#444', fontSize: 13, fontWeight: '500', marginBottom: 6, letterSpacing: 0.3 },
  heroTitle:      { color: WHITE, fontSize: 30, fontWeight: '800', lineHeight: 36, letterSpacing: -0.8 },
  locPill:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: CARD, borderRadius: 22, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: BORDER, maxWidth: 120 },
  locPin:         { fontSize: 11 },
  locTxt:         { color: '#555', fontSize: 11, fontWeight: '600' },
  searchBar:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#111', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: BORDER },
  searchIcon:     { fontSize: 15 },
  searchInput:    { flex: 1, color: WHITE, fontSize: 15 },
  clearBtn:       { padding: 2 },
  clearTxt:       { color: '#333', fontSize: 15 },

  // Categories
  catScroll:      { marginTop: 14, marginBottom: 2 },
  catChip:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CARD, borderRadius: 26, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8, borderWidth: 1, borderColor: BORDER },
  catChipActive:  { backgroundColor: ORANGE, borderColor: ORANGE },
  catEmoji:       { fontSize: 14 },
  catTxt:         { color: '#555', fontSize: 13, fontWeight: '600' },
  catTxtActive:   { color: WHITE, fontWeight: '700' },

  // Section headers
  secRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginTop: 26, marginBottom: 14 },
  secTitle:       { color: WHITE, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  countBadge:     { backgroundColor: '#1a1a1a', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: BORDER },
  countTxt:       { color: '#444', fontSize: 12, fontWeight: '600' },

  // Featured card
  featCard:       { marginHorizontal: 16, marginBottom: 16, borderRadius: 24, overflow: 'hidden', backgroundColor: CARD, elevation: 6, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16 },
  featImg:        { width: '100%', height: 220 },
  featGradient:   { ...StyleSheet.absoluteFillObject, height: 220, background: 'transparent', backgroundColor: 'transparent',
                    // Simulate gradient with absolute overlay at bottom
                  },
  featTopRow:     { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catTag:         { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  catTagTxt:      { color: WHITE, fontSize: 12, fontWeight: '600' },
  statusTag:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  statusOpen:     { backgroundColor: 'rgba(0,0,0,0.6)', borderColor: 'rgba(76,175,80,0.3)' },
  statusClosed:   { backgroundColor: 'rgba(0,0,0,0.6)', borderColor: 'rgba(154,152,255,0.3)' },
  statusDot:      { width: 6, height: 6, borderRadius: 3 },
  statusTxt:      { fontSize: 11, fontWeight: '700' },
  featBottom:     { padding: 16, backgroundColor: CARD },
  featName:       { color: WHITE, fontSize: 21, fontWeight: '800', letterSpacing: -0.4, marginBottom: 4 },
  featDesc:       { color: '#555', fontSize: 13, marginBottom: 12 },
  featMetaRow:    { flexDirection: 'row', gap: 8 },
  metaChip:       { backgroundColor: '#1a1a1a', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: BORDER },
  metaChipTxt:    { color: '#888', fontSize: 12 },
  metaChipPreorder:    { backgroundColor: '#12123a', borderColor: '#3a3a7a' },
  metaChipPreorderTxt: { color: '#9a98ff', fontSize: 12, fontWeight: '600' },

  // Compact card
  compCard:       { flexDirection: 'row', marginHorizontal: 16, marginBottom: 10, borderRadius: 18, overflow: 'hidden', backgroundColor: CARD, borderWidth: 1, borderColor: BORDER },
  compImgWrap:    { position: 'relative' },
  compImg:        { width: 96, height: 96 },
  compImgOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  compBody:       { flex: 1, padding: 12, justifyContent: 'center' },
  compTopRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  compName:       { color: WHITE, fontSize: 15, fontWeight: '700', flex: 1 },
  compCatBadge:   { backgroundColor: '#1a1a1a', borderRadius: 8, width: 28, height: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  compDesc:       { color: '#444', fontSize: 12, marginBottom: 8 },
  compMeta:       { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  compMetaTxt:    { color: '#555', fontSize: 11 },
  compMetaDot:    { color: '#2a2a2a', fontSize: 13 },
  openDotRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:            { width: 5, height: 5, borderRadius: 3 },

  // Utils
  imgDim:         { opacity: 0.45 },
  errorBox:       { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  errorEmoji:     { fontSize: 40, marginBottom: 12 },
  errorTitle:     { color: '#555', fontSize: 15, textAlign: 'center', marginBottom: 16 },
  retryBtn:       { backgroundColor: '#131313', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: '#1c1c1c' },
  retryTxt:       { color: '#FF6B35', fontWeight: '600', fontSize: 14 },
  emptyBox:       { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyEmoji:     { fontSize: 52, marginBottom: 16 },
  emptyTitle:     { color: '#444', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  emptySub:       { color: '#2a2a2a', fontSize: 13, marginTop: 6, textAlign: 'center' },
})

