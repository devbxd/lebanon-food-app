import * as Location from 'expo-location'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
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

const CATEGORIES = ['Tout', 'Burgers', 'Shawarma', 'Pizza', 'Healthy', 'Sushi', 'Grillades']

const CAT_ICONS = {
  'Tout': '🍽️', 'Burgers': '🍔', 'Shawarma': '🌯',
  'Pizza': '🍕', 'Healthy': '🥗', 'Sushi': '🍣', 'Grillades': '🥩',
}

export default function HomeScreen() {
  const { t } = useTranslation()
  const [restaurants, setRestaurants] = useState([])
  const [search, setSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('Tout')
  const [location, setLocation] = useState(null)
  const [user, setUser] = useState(null)
  const router = useRouter()

  useEffect(() => {
    fetchRestaurants()
    getLocation()
    getUser()

    const channelName = `restaurants-open-status-${Date.now()}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurants' }, () => {
        fetchRestaurants()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
    const { data } = await supabase.from('restaurants').select('*')
    if (data) setRestaurants(data)
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
        style={styles.featuredCard}
        onPress={() => router.push(`/restaurants/${resto.id}`)}
        activeOpacity={0.9}
      >
        <Image source={{ uri: resto.image_url }} style={[styles.featuredImg, !isOpen && styles.imgClosed]} />
        <View style={styles.featuredOverlay} />

        {!isOpen && (
          <View style={styles.closedOverlay}>
            <View style={styles.closedPill}>
              <Text style={styles.closedPillText}>🔴 Fermé — Précommande disponible</Text>
            </View>
          </View>
        )}

        <View style={styles.featuredBadge}>
          <Text style={styles.featuredBadgeText}>{CAT_ICONS[resto.category] || '🍽️'} {resto.category}</Text>
        </View>

        {isOpen ? (
          <View style={styles.openBadge}>
            <View style={styles.openDot} />
            <Text style={styles.openText}>{t('home.openNow')}</Text>
          </View>
        ) : (
          <View style={[styles.openBadge, styles.closedBadge]}>
            <View style={styles.closedDot} />
            <Text style={styles.closedText}>⏰ Précommande</Text>
          </View>
        )}

        <View style={styles.featuredBody}>
          <Text style={styles.featuredName}>{resto.name}</Text>
          <Text style={styles.featuredDesc} numberOfLines={1}>{resto.description}</Text>
          {isOpen ? (
            <View style={styles.featuredMeta}>
              <View style={styles.metaPill}><Text style={styles.metaText}>⏱ {resto.delivery_time}</Text></View>
              <View style={styles.metaPill}><Text style={styles.metaText}>💵 Min ${resto.min_order}</Text></View>
            </View>
          ) : (
            <View style={styles.featuredMeta}>
              <View style={[styles.metaPill, styles.preorderPill]}>
                <Text style={styles.preorderPillText}>⏰ Commandez à l'avance</Text>
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
        style={styles.compactCard}
        onPress={() => router.push(`/restaurants/${resto.id}`)}
        activeOpacity={0.85}
      >
        <View>
          <Image source={{ uri: resto.image_url }} style={[styles.compactImg, !isOpen && styles.imgClosed]} />
          {!isOpen && (
            <View style={styles.compactClosedOverlay}>
              <Text style={styles.compactClosedText}>⏰</Text>
            </View>
          )}
        </View>
        <View style={styles.compactBody}>
          <View style={styles.compactTop}>
            <Text style={styles.compactName}>{resto.name}</Text>
            <View style={styles.compactBadge}>
              <Text style={styles.compactBadgeText}>{CAT_ICONS[resto.category] || '🍽️'}</Text>
            </View>
          </View>
          <Text style={styles.compactDesc} numberOfLines={1}>{resto.description}</Text>
          <View style={styles.compactMeta}>
            {isOpen ? (
              <>
                <Text style={styles.compactMetaText}>⏱ {resto.delivery_time}</Text>
                <Text style={styles.compactMetaDot}>·</Text>
                <Text style={styles.compactMetaText}>💵 Min ${resto.min_order}</Text>
                <Text style={styles.compactMetaDot}>·</Text>
                <View style={styles.openSmallBadge}>
                  <View style={styles.openDotSmall} />
                  <Text style={styles.openSmallText}>Ouvert</Text>
                </View>
              </>
            ) : (
              <View style={styles.openSmallBadge}>
                <View style={styles.closedDotSmall} />
                <Text style={styles.closedSmallText}>⏰ Précommande</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>
                {firstName ? `Salut ${firstName} 👋` : 'Bonsoir 👋'}
              </Text>
              <Text style={styles.title}>Qu'est-ce qui{'\n'}te fait envie ?</Text>
            </View>
            <View style={styles.headerRight}>
              {location && (
                <View style={styles.locationPill}>
                  <Text style={styles.locationPin}>📍</Text>
                  <Text style={styles.locationText}>{location}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={t('home.searchPlaceholder')}
              placeholderTextColor="#555"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={styles.clearBtn}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={styles.catScroll}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 4 }}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, selectedCat === cat && styles.catChipActive]}
              onPress={() => setSelectedCat(cat)}
              activeOpacity={0.7}
            >
              <Text style={styles.catIcon}>{CAT_ICONS[cat]}</Text>
              <Text style={[styles.catText, selectedCat === cat && styles.catTextActive]}>
                {getCatLabel(cat)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtered.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={styles.emptyTitle}>{t('home.noRestaurants')}</Text>
            <Text style={styles.emptySubtitle}>Essaie une autre catégorie</Text>
          </View>
        )}

        {featured.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {selectedCat === 'Tout' ? '⭐ À la une' : `${CAT_ICONS[selectedCat]} ${getCatLabel(selectedCat)}`}
              </Text>
              {filtered.length > 0 && <Text style={styles.sectionCount}>{filtered.length} restos</Text>}
            </View>
            {featured.map(resto => <RestoFeaturedCard key={resto.id} resto={resto} />)}
          </>
        )}

        {rest.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🔥 Autres restos</Text>
            </View>
            {rest.map(resto => <RestoCompactCard key={resto.id} resto={resto} />)}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  header: { backgroundColor: '#1a1a1a', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  headerRight: { alignItems: 'flex-end', paddingTop: 4 },
  greeting: { color: '#888', fontSize: 14, marginBottom: 4 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', lineHeight: 34, letterSpacing: -0.5 },
  locationPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#222', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#2a2a2a' },
  locationPin: { fontSize: 11 },
  locationText: { color: '#888', fontSize: 12, fontWeight: '500' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#222', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: '#2a2a2a' },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  clearBtn: { color: '#555', fontSize: 16, paddingLeft: 4 },
  catScroll: { marginTop: 16, marginBottom: 4 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a1a', borderRadius: 24, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8, borderWidth: 1, borderColor: '#2a2a2a' },
  catChipActive: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  catIcon: { fontSize: 14 },
  catText: { color: '#777', fontSize: 13, fontWeight: '500' },
  catTextActive: { color: '#fff', fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 24, marginBottom: 14 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  sectionCount: { color: '#555', fontSize: 13 },
  featuredCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 22, overflow: 'hidden', backgroundColor: '#1e1e1e', elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
  featuredImg: { width: '100%', height: 210 },
  featuredOverlay: { ...StyleSheet.absoluteFillObject, height: 210, backgroundColor: 'rgba(0,0,0,0.35)' },
  featuredBadge: { position: 'absolute', top: 14, left: 14, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  featuredBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  openBadge: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(74,154,74,0.4)' },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
  openText: { color: '#4CAF50', fontSize: 11, fontWeight: '600' },
  featuredBody: { padding: 16 },
  featuredName: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  featuredDesc: { color: '#888', fontSize: 13, marginTop: 4 },
  featuredMeta: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metaPill: { backgroundColor: '#2a2a2a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  metaText: { color: '#bbb', fontSize: 12 },
  preorderPill: { backgroundColor: '#1a1a2e', borderColor: '#3a3a6a', borderWidth: 1 },
  preorderPillText: { color: '#9a98ff', fontSize: 12, fontWeight: '600' },
  compactCard: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#222' },
  compactImg: { width: 100, height: 100 },
  compactBody: { flex: 1, padding: 12, justifyContent: 'center' },
  compactTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  compactName: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  compactBadge: { backgroundColor: '#222', borderRadius: 8, width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  compactBadgeText: { fontSize: 14 },
  compactDesc: { color: '#666', fontSize: 12, marginBottom: 8 },
  compactMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  compactMetaText: { color: '#777', fontSize: 11 },
  compactMetaDot: { color: '#444', fontSize: 11 },
  openSmallBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  openDotSmall: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#4CAF50' },
  openSmallText: { color: '#4CAF50', fontSize: 11, fontWeight: '600' },
  imgClosed: { opacity: 0.5 },
  closedOverlay: { ...StyleSheet.absoluteFillObject, height: 210, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  closedPill: { backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#7a78cf44' },
  closedPillText: { color: '#9a98ff', fontSize: 13, fontWeight: '700' },
  closedBadge: { borderColor: 'rgba(122,120,207,0.4)' },
  closedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#9a98ff' },
  closedText: { color: '#9a98ff', fontSize: 11, fontWeight: '600' },
  compactClosedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  compactClosedText: { fontSize: 20 },
  closedDotSmall: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#9a98ff' },
  closedSmallText: { color: '#9a98ff', fontSize: 11, fontWeight: '600' },
  emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { color: '#555', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  emptySubtitle: { color: '#333', fontSize: 13, marginTop: 6, textAlign: 'center' },
})

