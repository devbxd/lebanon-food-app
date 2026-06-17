import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  Modal, ScrollView, TextInput, ActivityIndicator
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useTranslation } from '../../lib/LanguageContext'
import { LANGUAGES } from '../../lib/i18n'

export default function ProfileScreen() {
  const { t, lang, setLang } = useTranslation()
  const router = useRouter()

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [langModalVisible, setLangModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)

  // Champs édition
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadUser() }, [])

  async function loadUser() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    setEditName(user?.user_metadata?.full_name || '')
    setEditEmail(user?.email || '')
    setLoading(false)
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

  async function handleSelectLang(code) {
    await setLang(code)
    setLangModalVisible(false)
  }

  const name = user?.user_metadata?.full_name || 'Utilisateur'
  const phone = user?.phone || user?.user_metadata?.phone || ''
  const email = user?.email || ''
  const initials = name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || '?'
  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0]

  if (loading) return (
    <View style={styles.loadingBox}>
      <ActivityIndicator color="#FF6B35" size="large" />
    </View>
  )

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header avatar */}
        <View style={styles.headerBg}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <Text style={styles.name}>{name}</Text>
          {phone ? <Text style={styles.headerSub}>📱 {phone}</Text> : null}
          {email ? <Text style={styles.headerSub}>✉️ {email}</Text> : null}

          <TouchableOpacity style={styles.editBtn} onPress={() => setEditModalVisible(true)}>
            <Text style={styles.editBtnTxt}>✏️ Modifier le profil</Text>
          </TouchableOpacity>
        </View>

        {/* Infos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MON COMPTE</Text>
          <View style={styles.card}>
            <InfoRow icon="👤" label="Nom complet" value={name} />
            <Divider />
            <InfoRow icon="📱" label="Téléphone" value={phone || '—'} />
            <Divider />
            <InfoRow icon="✉️" label="Email" value={email || '—'} />
          </View>
        </View>

        {/* Langue */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRÉFÉRENCES</Text>
          <TouchableOpacity style={styles.card} onPress={() => setLangModalVisible(true)}>
            <View style={styles.rowBetween}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>🌍</Text>
                <View>
                  <Text style={styles.rowLabel}>{t('profile.language')}</Text>
                  <Text style={styles.rowSub}>{t('profile.languageSub')}</Text>
                </View>
              </View>
              <View style={styles.langBadge}>
                <Text style={styles.langBadgeFlag}>{currentLang.flag}</Text>
                <Text style={styles.langBadgeTxt}>{currentLang.label}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Déconnexion */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutText}>🚪 {t('profile.logout')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal édition profil */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>✏️ Modifier le profil</Text>

            <Text style={styles.inputLabel}>Nom complet</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Ton nom"
              placeholderTextColor="#555"
            />

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="ton@email.com"
              placeholderTextColor="#555"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.phoneNote}>📱 Le numéro de téléphone ne peut pas être modifié</Text>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelBtnTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
                <Text style={styles.saveBtnTxt}>{saving ? 'Sauvegarde...' : 'Sauvegarder'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal langue */}
      <Modal visible={langModalVisible} transparent animationType="fade" onRequestClose={() => setLangModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLangModalVisible(false)}>
          <View style={styles.modalBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('language.title')}</Text>
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[styles.langOption, lang === l.code && styles.langOptionActive]}
                onPress={() => handleSelectLang(l.code)}
              >
                <Text style={styles.langOptionFlag}>{l.flag}</Text>
                <Text style={[styles.langOptionLabel, lang === l.code && styles.langOptionLabelActive]}>{l.label}</Text>
                {lang === l.code && <View style={styles.modalCheck} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  )
}

function Divider() {
  return <View style={styles.divider} />
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  loadingBox: { flex: 1, backgroundColor: '#0d0d0d', justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 30 },

  // Header
  headerBg: {
    backgroundColor: '#161616',
    paddingTop: 70, paddingBottom: 28,
    alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#1f1f1f',
    marginBottom: 8,
  },
  avatarRing: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2, borderColor: '#FF6B3566',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: '#FF6B35',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  name: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 6 },
  headerSub: { color: '#555', fontSize: 13, marginBottom: 2 },
  editBtn: {
    marginTop: 14, backgroundColor: '#1f1f1f',
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  editBtnTxt: { color: '#FF6B35', fontSize: 13, fontWeight: '600' },

  // Sections
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: {
    color: '#444', fontSize: 11, fontWeight: '700',
    letterSpacing: 1.2, marginBottom: 10,
  },

  card: {
    backgroundColor: '#161616', borderRadius: 18,
    borderWidth: 1, borderColor: '#1f1f1f', overflow: 'hidden',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  infoIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  infoLabel: { color: '#555', fontSize: 11, marginBottom: 2 },
  infoValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#1f1f1f', marginLeft: 52 },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  rowLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rowSub: { color: '#555', fontSize: 12, marginTop: 2 },
  langBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1f1f1f', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  langBadgeFlag: { fontSize: 15 },
  langBadgeTxt: { color: '#888', fontSize: 12, fontWeight: '600' },
  chevron: { color: '#444', fontSize: 18, marginLeft: 2 },

  logoutBtn: {
    backgroundColor: '#161616', borderRadius: 14,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#f4433630',
  },
  logoutText: { color: '#f44336', fontWeight: '600', fontSize: 15 },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#161616', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  modalTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  inputLabel: { color: '#666', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#111', borderRadius: 12, padding: 14,
    color: '#fff', fontSize: 15, borderWidth: 1,
    borderColor: '#2a2a2a', marginBottom: 14,
  },
  phoneNote: { color: '#444', fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  modalFooter: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center',
  },
  cancelBtnTxt: { color: '#666', fontWeight: '600' },
  saveBtn: {
    flex: 2, padding: 14, borderRadius: 12,
    backgroundColor: '#FF6B35', alignItems: 'center',
  },
  saveBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },

  langOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#111', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#2a2a2a',
  },
  langOptionActive: { borderColor: '#FF6B35', backgroundColor: '#2a1a10' },
  langOptionFlag: { fontSize: 22 },
  langOptionLabel: { color: '#888', fontSize: 15, fontWeight: '600', flex: 1 },
  langOptionLabelActive: { color: '#fff' },
  modalCheck: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B35' },
})