import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useTranslation } from '../../lib/LanguageContext'
import { LANGUAGES } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────
const ORANGE  = '#FF6B35'
const BG      = '#080808'
const CARD    = '#111111'
const CARD2   = '#161616'
const BORDER  = '#1f1f1f'
const WHITE   = '#ffffff'
const MUTED   = '#888'
const DIM     = '#444'

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { t, lang, setLang } = useTranslation()
  const router = useRouter()

  const [user,             setUser]             = useState(null)
  const [loading,          setLoading]          = useState(true)
  const [avatarUri,        setAvatarUri]        = useState(null)
  const [uploadingAvatar,  setUploadingAvatar]  = useState(false)
  const [langModal,        setLangModal]        = useState(false)
  const [editModal,        setEditModal]        = useState(false)
  const [editName,         setEditName]         = useState('')
  const [saving,           setSaving]           = useState(false)

  const fadeAnim  = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.94)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  // Pulse glow loop
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 2000, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  useEffect(() => { loadUser() }, [])

  async function loadUser() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    setEditName(user?.user_metadata?.full_name || '')

    // Load stored avatar from Supabase Storage
    if (user?.id) {
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(`${user.id}/avatar.jpg`)
      if (data?.publicUrl) {
        // Bust cache on reload
        setAvatarUri(`${data.publicUrl}?t=${Date.now()}`)
      }
    }

    setLoading(false)
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1,    duration: 520, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 520, useNativeDriver: true }),
    ]).start()
  }

  // ── Avatar picker ──────────────────────────────────────────────────────────
  async function pickAvatar() {
    // Ask permission
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Active l\'accès à ta galerie dans les réglages.')
        return
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    })

    if (result.canceled) return

    const uri = result.assets[0].uri
    await uploadAvatar(uri)
  }

  async function uploadAvatar(uri) {
    if (!user?.id) return
    setUploadingAvatar(true)

    try {
      // Fetch blob from local URI
      const response = await fetch(uri)
      const blob     = await response.blob()

      const filePath = `${user.id}/avatar.jpg`
      const { error } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (error) throw error

      // Refresh displayed avatar
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      setAvatarUri(`${data.publicUrl}?t=${Date.now()}`)
    } catch (err) {
      Alert.alert('Erreur', err.message || 'Impossible d\'enregistrer la photo.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  // ── Save profile ───────────────────────────────────────────────────────────
  async function saveProfile() {
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: editName } })
    setSaving(false)
    if (error) {
      Alert.alert('Erreur', error.message)
    } else {
      await loadUser()
      setEditModal(false)
    }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async function logout() {
    Alert.alert(t('profile.logoutConfirmTitle'), t('profile.logoutConfirmMsg'), [
      { text: t('profile.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'), style: 'destructive', onPress: async () => {
          await supabase.auth.signOut()
          router.replace('/login')
        }
      }
    ])
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const name        = user?.user_metadata?.full_name || 'Utilisateur'
  const phone       = user?.phone || user?.user_metadata?.phone || ''
  const initials    = name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || '?'
  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]

  if (loading) return (
    <View style={s.loadingBox}>
      <ActivityIndicator color={ORANGE} size="large" />
    </View>
  )

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        <Animated.View style={[s.hero, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>

          {/* Radial glow (pulsing) */}
          <Animated.View style={[s.glowCircle, { transform: [{ scale: pulseAnim }] }]} />

          {/* Avatar tap zone */}
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} style={s.avatarWrap}>
            <View style={s.avatarRing}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={s.avatarImg}
                  contentFit="cover"
                  transition={300}
                />
              ) : (
                <View style={s.avatarFallback}>
                  <Text style={s.avatarInitials}>{initials}</Text>
                </View>
              )}

              {/* Camera overlay */}
              <View style={s.cameraOverlay}>
                {uploadingAvatar
                  ? <ActivityIndicator color={WHITE} size="small" />
                  : <Text style={s.cameraIcon}>📷</Text>
                }
              </View>
            </View>
          </TouchableOpacity>

          <Text style={s.heroName}>{name}</Text>
          {phone ? <Text style={s.heroPhone}>{phone}</Text> : null}

          <TouchableOpacity style={s.editBtn} onPress={() => setEditModal(true)} activeOpacity={0.8}>
            <Text style={s.editBtnTxt}>Modifier le profil</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Stats ── */}
        <Animated.View style={[s.statsRow, { opacity: fadeAnim }]}>
          <StatBox emoji="🛍️" label="Commandes" value="—" />
          <View style={s.statDivider} />
          <StatBox emoji="❤️" label="Favoris"   value="—" />
          <View style={s.statDivider} />
          <StatBox emoji="⭐" label="Avis"       value="—" />
        </Animated.View>

        {/* ── Préférences ── */}
        <Animated.View style={[s.section, { opacity: fadeAnim }]}>
          <Text style={s.sectionLabel}>PRÉFÉRENCES</Text>
          <View style={s.card}>
            <TouchableOpacity onPress={() => setLangModal(true)} activeOpacity={0.75}>
              <View style={s.menuRow}>
                <View style={s.menuLeft}>
                  <View style={s.menuIcon}><Text style={s.menuIconEmoji}>🌍</Text></View>
                  <View>
                    <Text style={s.menuTitle}>{t('profile.language')}</Text>
                    <Text style={s.menuSub}>{t('profile.languageSub')}</Text>
                  </View>
                </View>
                <View style={s.langPill}>
                  <Text style={s.langPillFlag}>{currentLang.flag}</Text>
                  <Text style={s.langPillTxt}>{currentLang.label}</Text>
                  <Text style={s.chevron}>›</Text>
                </View>
              </View>
            </TouchableOpacity>


          </View>
        </Animated.View>

        {/* ── Légal ── */}
        <Animated.View style={[s.section, { opacity: fadeAnim }]}>
          <Text style={s.sectionLabel}>LÉGAL</Text>
          <View style={s.card}>
            <TouchableOpacity onPress={() => router.push('/privacy')} activeOpacity={0.75}>
              <View style={s.menuRow}>
                <View style={s.menuLeft}>
                  <View style={s.menuIcon}><Text style={s.menuIconEmoji}>🔒</Text></View>
                  <View>
                    <Text style={s.menuTitle}>Confidentialité & CGU</Text>
                    <Text style={s.menuSub}>Politique de confidentialité</Text>
                  </View>
                </View>
                <Text style={s.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Déconnexion ── */}
        <Animated.View style={[s.section, { opacity: fadeAnim }]}>
          <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.8}>
            <Text style={s.logoutIcon}>🚪</Text>
            <Text style={s.logoutTxt}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── Modal édition ── */}
      <Modal visible={editModal} transparent animationType="slide" onRequestClose={() => setEditModal(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Modifier le profil</Text>

            {/* Avatar in modal */}
            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} style={s.modalAvatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.modalAvatarImg} contentFit="cover" transition={200} />
              ) : (
                <View style={s.modalAvatarFallback}>
                  <Text style={s.modalAvatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={s.modalCameraTag}>
                <Text style={{ fontSize: 11 }}>📷</Text>
                <Text style={s.modalCameraTagTxt}>Changer</Text>
              </View>
            </TouchableOpacity>

            <Text style={s.inputLabel}>Nom complet</Text>
            <TextInput
              style={s.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Ton nom"
              placeholderTextColor={DIM}
            />

            <View style={s.phoneNotice}>
              <Text style={{ fontSize: 14 }}>🔒</Text>
              <Text style={s.phoneNoticeTxt}>Numéro de téléphone non modifiable</Text>
            </View>

            <View style={s.sheetFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditModal(false)}>
                <Text style={s.cancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={saveProfile} disabled={saving}>
                <Text style={s.saveTxt}>{saving ? '...' : 'Sauvegarder'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal langue ── */}
      <Modal visible={langModal} transparent animationType="fade" onRequestClose={() => setLangModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setLangModal(false)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{t('language.title')}</Text>
            {LANGUAGES.map(l => (
              <TouchableOpacity
                key={l.code}
                style={[s.langOption, lang === l.code && s.langOptionActive]}
                onPress={async () => { await setLang(l.code); setLangModal(false) }}
                activeOpacity={0.75}
              >
                <Text style={s.langFlag}>{l.flag}</Text>
                <Text style={[s.langLabel, lang === l.code && { color: WHITE }]}>{l.label}</Text>
                {lang === l.code && <View style={s.activeDot} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatBox({ emoji, label, value }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statEmoji}>{emoji}</Text>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: BG },
  loadingBox: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  scroll:     { paddingBottom: 20 },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 36,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    overflow: 'hidden',
  },
  glowCircle: {
    position: 'absolute',
    top: 10,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: ORANGE,
    opacity: 0.07,
  },

  // Avatar
  avatarWrap:   { marginBottom: 18 },
  avatarRing: {
    width: 104, height: 104, borderRadius: 52,
    borderWidth: 2, borderColor: ORANGE + '60',
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  avatarImg:      { width: 92, height: 92, borderRadius: 46 },
  avatarFallback: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: ORANGE,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitials: { color: WHITE, fontSize: 34, fontWeight: '800' },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#222',
    borderWidth: 2, borderColor: BG,
    justifyContent: 'center', alignItems: 'center',
  },
  cameraIcon: { fontSize: 13 },

  heroName:  { color: WHITE, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  heroPhone: { color: MUTED, fontSize: 13, marginBottom: 18 },

  editBtn: {
    backgroundColor: 'transparent',
    borderRadius: 22, paddingHorizontal: 22, paddingVertical: 9,
    borderWidth: 1, borderColor: ORANGE + '50',
  },
  editBtnTxt: { color: ORANGE, fontSize: 13, fontWeight: '700' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: CARD2,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  statBox:     { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statEmoji:   { fontSize: 20, marginBottom: 5 },
  statValue:   { color: WHITE, fontSize: 16, fontWeight: '700' },
  statLabel:   { color: DIM, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: BORDER, marginVertical: 14 },

  // Sections
  section:      { paddingHorizontal: 16, marginTop: 16 },
  sectionLabel: {
    color: '#2e2e2e',
    fontSize: 10, fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8, paddingLeft: 4,
  },
  card: {
    backgroundColor: CARD2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },

  // Menu rows
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14, gap: 12,
  },
  menuLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  menuIconEmoji: { fontSize: 15 },
  menuTitle: { color: WHITE, fontSize: 14, fontWeight: '600' },
  menuSub:   { color: DIM, fontSize: 11, marginTop: 2 },
  chevron:   { color: '#2e2e2e', fontSize: 20, fontWeight: '300' },
  divider:   { height: 1, backgroundColor: BORDER, marginLeft: 62 },

  langPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#1a1a1a', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: BORDER,
  },
  langPillFlag: { fontSize: 14 },
  langPillTxt:  { color: MUTED, fontSize: 12, fontWeight: '600' },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#120505',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#f4433618',
  },
  logoutIcon: { fontSize: 16 },
  logoutTxt:  { color: '#f44336', fontWeight: '700', fontSize: 15 },

  // Modals
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0e0e0e',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 48,
    borderWidth: 1, borderColor: BORDER,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#222', alignSelf: 'center', marginBottom: 22,
  },
  sheetTitle: { color: WHITE, fontSize: 17, fontWeight: '700', marginBottom: 22, textAlign: 'center' },

  // Avatar in edit modal
  modalAvatarWrap: { alignSelf: 'center', marginBottom: 24 },
  modalAvatarImg:  { width: 80, height: 80, borderRadius: 40 },
  modalAvatarFallback: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: ORANGE,
    justifyContent: 'center', alignItems: 'center',
  },
  modalAvatarInitials: { color: WHITE, fontSize: 28, fontWeight: '800' },
  modalCameraTag: {
    position: 'absolute', bottom: -2, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#222', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: BORDER,
    left: '50%', transform: [{ translateX: -34 }],
  },
  modalCameraTagTxt: { color: MUTED, fontSize: 11, fontWeight: '600' },

  inputLabel: { color: DIM, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 7 },
  input: {
    backgroundColor: '#0a0a0a', borderRadius: 14, padding: 14,
    color: WHITE, fontSize: 15, borderWidth: 1,
    borderColor: BORDER, marginBottom: 16,
  },
  phoneNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 12, marginBottom: 24,
    borderWidth: 1, borderColor: BORDER,
  },
  phoneNoticeTxt: { color: DIM, fontSize: 12, flex: 1 },

  sheetFooter: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER, alignItems: 'center',
  },
  cancelTxt: { color: MUTED, fontWeight: '600', fontSize: 14 },
  saveBtn: {
    flex: 2, padding: 14, borderRadius: 14,
    backgroundColor: ORANGE, alignItems: 'center',
    shadowColor: ORANGE, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  saveTxt: { color: WHITE, fontWeight: '700', fontSize: 15 },

  // Lang options
  langOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0d0d0d', borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: BORDER,
  },
  langOptionActive: { borderColor: ORANGE, backgroundColor: '#140a04' },
  langFlag:  { fontSize: 22 },
  langLabel: { color: '#666', fontSize: 15, fontWeight: '600', flex: 1 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE },
})

