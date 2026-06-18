import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated, Dimensions,
  Modal, ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { useTranslation } from '../../lib/LanguageContext'
import { LANGUAGES } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'

const { width } = Dimensions.get('window')

export default function ProfileScreen() {
  const { t, lang, setLang } = useTranslation()
  const router = useRouter()

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [langModalVisible, setLangModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => { loadUser() }, [])

  async function loadUser() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    setEditName(user?.user_metadata?.full_name || '')
    setEditEmail(user?.email || '')
    setLoading(false)
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()
  }

  async function saveProfile() {
    setSaving(true)
    const updates = { data: { full_name: editName } }
    if (editEmail && editEmail !== user?.email) updates.email = editEmail
    const { error } = await supabase.auth.updateUser(updates)
    setSaving(false)
    if (error) {
      Alert.alert('Erreur', error.message)
    } else {
      await loadUser()
      setEditModalVisible(false)
      Alert.alert('✅ Profil mis à jour')
    }
  }

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

  const name = user?.user_metadata?.full_name || 'Utilisateur'
  const phone = user?.phone || user?.user_metadata?.phone || ''
  const email = user?.email || ''
  const initials = name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || '?'
  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]

  if (loading) return (
    <View style={s.loadingBox}>
      <ActivityIndicator color="#FF6B35" size="large" />
    </View>
  )

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero Header ── */}
        <Animated.View style={[s.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Glow derrière avatar */}
          <View style={s.avatarGlow} />
          <View style={s.avatarRing}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
          </View>

          <Text style={s.heroName}>{name}</Text>

          <View style={s.heroBadges}>
            {phone ? (
              <View style={s.badge}>
                <Text style={s.badgeIcon}>📱</Text>
                <Text style={s.badgeTxt}>{phone}</Text>
              </View>
            ) : null}
            {email ? (
              <View style={s.badge}>
                <Text style={s.badgeIcon}>✉️</Text>
                <Text style={s.badgeTxt}>{email}</Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity style={s.editBtn} onPress={() => setEditModalVisible(true)} activeOpacity={0.8}>
            <Text style={s.editBtnTxt}>✏️  Modifier le profil</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Stats rapides ── */}
        <Animated.View style={[s.statsRow, { opacity: fadeAnim }]}>
          <StatBox emoji="🛍️" label="Commandes" value="—" />
          <View style={s.statDivider} />
          <StatBox emoji="❤️" label="Favoris" value="—" />
          <View style={s.statDivider} />
          <StatBox emoji="⭐" label="Avis" value="—" />
        </Animated.View>

        {/* ── Mon compte ── */}
        <Animated.View style={[s.section, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={s.sectionLabel}>MON COMPTE</Text>
          <View style={s.card}>
            <InfoRow icon="👤" label="Nom complet" value={name} />
            <View style={s.divider} />
            <InfoRow icon="📱" label="Téléphone" value={phone || '—'} />
            <View style={s.divider} />
            <InfoRow icon="✉️" label="Email" value={email || '—'} />
          </View>
        </Animated.View>

        {/* ── Préférences ── */}
        <Animated.View style={[s.section, { opacity: fadeAnim }]}>
          <Text style={s.sectionLabel}>PRÉFÉRENCES</Text>
          <TouchableOpacity style={s.card} onPress={() => setLangModalVisible(true)} activeOpacity={0.75}>
            <View style={s.rowBetween}>
              <View style={s.rowLeft}>
                <View style={s.iconBox}>
                  <Text style={s.rowIcon}>🌍</Text>
                </View>
                <View>
                  <Text style={s.rowLabel}>{t('profile.language')}</Text>
                  <Text style={s.rowSub}>{t('profile.languageSub')}</Text>
                </View>
              </View>
              <View style={s.langPill}>
                <Text style={s.langPillFlag}>{currentLang.flag}</Text>
                <Text style={s.langPillTxt}>{currentLang.label}</Text>
                <Text style={s.chevron}>›</Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Déconnexion ── */}
        <Animated.View style={[s.section, { opacity: fadeAnim }]}>
          <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.8}>
            <Text style={s.logoutIcon}>🚪</Text>
            <Text style={s.logoutTxt}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* ── Modal édition ── */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>✏️  Modifier le profil</Text>

            <Text style={s.inputLabel}>Nom complet</Text>
            <TextInput
              style={s.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Ton nom"
              placeholderTextColor="#444"
            />

            <Text style={s.inputLabel}>Email</Text>
            <TextInput
              style={s.input}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="ton@email.com"
              placeholderTextColor="#444"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={s.phoneNotice}>
              <Text style={s.phoneNoticeIcon}>🔒</Text>
              <Text style={s.phoneNoticeTxt}>Le numéro de téléphone ne peut pas être modifié</Text>
            </View>

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={s.cancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={saveProfile} disabled={saving}>
                <Text style={s.saveTxt}>{saving ? 'Sauvegarde...' : 'Sauvegarder'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal langue ── */}
      <Modal visible={langModalVisible} transparent animationType="fade" onRequestClose={() => setLangModalVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setLangModalVisible(false)}>
          <View style={s.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{t('language.title')}</Text>
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[s.langOption, lang === l.code && s.langOptionActive]}
                onPress={async () => { await setLang(l.code); setLangModalVisible(false) }}
                activeOpacity={0.75}
              >
                <Text style={s.langFlag}>{l.flag}</Text>
                <Text style={[s.langLabel, lang === l.code && s.langLabelActive]}>{l.label}</Text>
                {lang === l.code && <View style={s.activeDot} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

function StatBox({ emoji, label, value }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statEmoji}>{emoji}</Text>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={s.infoRow}>
      <View style={s.iconBox}>
        <Text style={s.infoIcon}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  )
}

const ORANGE = '#FF6B35'
const BG = '#0a0a0a'
const CARD = '#141414'
const BORDER = '#1e1e1e'
const WHITE = '#ffffff'
const GREY = '#555'

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: BG },
  loadingBox:   { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  scroll:       { paddingBottom: 20 },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 70,
    paddingBottom: 32,
    paddingHorizontal: 24,
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 6,
  },
  avatarGlow: {
    position: 'absolute',
    top: 50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: ORANGE,
    opacity: 0.12,
    transform: [{ scaleX: 2 }],
  },
  avatarRing: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 2, borderColor: ORANGE + '55',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: ORANGE,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText:   { color: WHITE, fontSize: 34, fontWeight: '800' },
  heroName:     { color: WHITE, fontSize: 24, fontWeight: '700', marginBottom: 10 },
  heroBadges:   { gap: 6, alignItems: 'center', marginBottom: 18 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1a1a1a', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: BORDER,
  },
  badgeIcon:    { fontSize: 12 },
  badgeTxt:     { color: GREY, fontSize: 12 },
  editBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 22, paddingHorizontal: 22, paddingVertical: 10,
    borderWidth: 1, borderColor: ORANGE + '40',
  },
  editBtnTxt:   { color: ORANGE, fontSize: 13, fontWeight: '700' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: CARD,
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  statBox:      { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statEmoji:    { fontSize: 20, marginBottom: 4 },
  statValue:    { color: WHITE, fontSize: 16, fontWeight: '700' },
  statLabel:    { color: GREY, fontSize: 11, marginTop: 2 },
  statDivider:  { width: 1, backgroundColor: BORDER, marginVertical: 12 },

  // Sections
  section:      { paddingHorizontal: 16, marginTop: 14 },
  sectionLabel: { color: '#333', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, paddingLeft: 4 },

  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  infoRow:      { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  infoIcon:     { fontSize: 16 },
  infoLabel:    { color: '#444', fontSize: 10, marginBottom: 2, fontWeight: '600' },
  infoValue:    { color: WHITE, fontSize: 14, fontWeight: '600' },
  divider:      { height: 1, backgroundColor: BORDER, marginLeft: 62 },

  rowBetween:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  rowLeft:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon:      { fontSize: 16 },
  rowLabel:     { color: WHITE, fontSize: 14, fontWeight: '600' },
  rowSub:       { color: GREY, fontSize: 11, marginTop: 2 },
  langPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#1a1a1a', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: BORDER,
  },
  langPillFlag: { fontSize: 14 },
  langPillTxt:  { color: '#888', fontSize: 12, fontWeight: '600' },
  chevron:      { color: '#333', fontSize: 18 },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1a0a0a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f4433625',
  },
  logoutIcon:   { fontSize: 18 },
  logoutTxt:    { color: '#f44336', fontWeight: '700', fontSize: 15 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 44,
    borderWidth: 1, borderColor: BORDER,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#2a2a2a', alignSelf: 'center', marginBottom: 20,
  },
  modalTitle:   { color: WHITE, fontSize: 17, fontWeight: '700', marginBottom: 22, textAlign: 'center' },
  inputLabel:   { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 7 },
  input: {
    backgroundColor: '#0d0d0d', borderRadius: 14, padding: 14,
    color: WHITE, fontSize: 15, borderWidth: 1,
    borderColor: BORDER, marginBottom: 16,
  },
  phoneNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 12, marginBottom: 22,
    borderWidth: 1, borderColor: BORDER,
  },
  phoneNoticeIcon:  { fontSize: 14 },
  phoneNoticeTxt:   { color: '#444', fontSize: 12, flex: 1 },
  modalFooter:  { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER, alignItems: 'center',
  },
  cancelTxt:    { color: GREY, fontWeight: '600', fontSize: 14 },
  saveBtn: {
    flex: 2, padding: 14, borderRadius: 14,
    backgroundColor: ORANGE, alignItems: 'center',
    shadowColor: ORANGE, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  saveTxt:      { color: WHITE, fontWeight: '700', fontSize: 15 },

  // Lang options
  langOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0d0d0d', borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: BORDER,
  },
  langOptionActive: { borderColor: ORANGE, backgroundColor: '#1a0d07' },
  langFlag:     { fontSize: 22 },
  langLabel:    { color: '#777', fontSize: 15, fontWeight: '600', flex: 1 },
  langLabelActive: { color: WHITE },
  activeDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE },
})


