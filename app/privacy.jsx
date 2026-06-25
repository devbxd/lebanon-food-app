import { useRouter } from 'expo-router'
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

const ORANGE = '#FF6B35'
const BG = '#0a0a0a'
const CARD = '#111'
const BORDER = '#1c1c1c'
const WHITE = '#fff'

export default function PrivacyScreen() {
  const router = useRouter()

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Confidentialité & CGU</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.heroBadge}>
          <Text style={s.heroEmoji}>🔒</Text>
          <Text style={s.heroTitle}>Tes données sont en sécurité</Text>
          <Text style={s.heroSub}>Dernière mise à jour : Juin 2025</Text>
        </View>

        <Section title="1. Qui sommes-nous">
          <P>Hungryyy est une plateforme de commande et livraison de repas opérant au Liban. Nous mettons en relation des clients, des restaurants et des livreurs via notre application mobile.</P>
          <P>Contact : hungryyy.app@gmail.com</P>
        </Section>

        <Section title="2. Données collectées">
          <P>Nous collectons uniquement ce qui est nécessaire au bon fonctionnement du service :</P>
          <BulletList items={[
            'Numéro de téléphone (authentification)',
            'Nom complet (optionnel, pour tes commandes)',
            'Adresse GPS et adresses de livraison',
            'Historique des commandes',
            'Token de notification push',
          ]} />
          <P>Nous ne collectons pas de données bancaires. Les paiements Whish sont traités directement par Whish Money.</P>
        </Section>

        <Section title="3. Utilisation des données">
          <BulletList items={[
            'Traitement et suivi de tes commandes',
            'Envoi de notifications sur l\'état de ta livraison',
            'Amélioration de l\'expérience utilisateur',
            'Communication avec le restaurant et le livreur',
          ]} />
          <P>Nous ne vendons pas tes données à des tiers. Tes informations ne sont jamais utilisées à des fins publicitaires.</P>
        </Section>

        <Section title="4. Partage des données">
          <P>Tes données sont partagées uniquement avec :</P>
          <BulletList items={[
            'Le restaurant concerné par ta commande (nom, téléphone, adresse)',
            'Le livreur assigné à ta commande (nom, téléphone, adresse GPS)',
            'Supabase (hébergement base de données sécurisé)',
          ]} />
        </Section>

        <Section title="5. Localisation GPS">
          <P>L'accès à ta position GPS est demandé uniquement au moment du checkout pour pré-remplir ton adresse, et jamais en arrière-plan. Tu peux entrer ton adresse manuellement sans activer la localisation.</P>
        </Section>

        <Section title="6. Notifications push">
          <P>Nous envoyons des notifications pour t'informer du statut de ta commande (acceptée, en préparation, en route, livrée). Tu peux désactiver ces notifications dans les réglages de ton téléphone à tout moment.</P>
        </Section>

        <Section title="7. Conservation des données">
          <P>Ton historique de commandes est conservé pendant 12 mois. Ton compte peut être supprimé sur simple demande à notre adresse email. Toutes tes données sont alors effacées sous 30 jours.</P>
        </Section>

        <Section title="8. Tes droits">
          <P>Conformément aux lois sur la protection des données, tu as le droit de :</P>
          <BulletList items={[
            'Accéder à toutes tes données personnelles',
            'Corriger des informations inexactes',
            'Demander la suppression de ton compte',
            'Retirer ton consentement à tout moment',
          ]} />
          <P>Pour exercer ces droits, contacte-nous à hungryyy.app@gmail.com</P>
        </Section>

        <Section title="9. Sécurité">
          <P>Tes données sont stockées sur des serveurs sécurisés (Supabase, Dublin). Les connexions sont chiffrées via HTTPS/TLS. L'accès est protégé par une authentification par numéro de téléphone.</P>
        </Section>

        <Section title="10. Conditions d'utilisation">
          <P>En utilisant Hungryyy, tu acceptes de :</P>
          <BulletList items={[
            'Ne pas utiliser l\'app à des fins illégales',
            'Fournir des informations exactes lors de la commande',
            'Être présent à l\'adresse indiquée lors de la livraison',
            'Contacter le livreur en cas de problème de localisation',
          ]} />
          <P>Hungryyy se réserve le droit de suspendre un compte en cas d'abus constaté (fausses commandes, refus répétés de livraison, etc.).</P>
        </Section>

        <Section title="11. Modifications">
          <P>Cette politique peut être mise à jour. En cas de modification significative, tu seras notifié dans l'application. La version en vigueur est toujours accessible depuis ton profil.</P>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

function Section({ title, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionBody}>{children}</View>
    </View>
  )
}

function P({ children }) {
  return <Text style={s.para}>{children}</Text>
}

function BulletList({ items }) {
  return (
    <View style={s.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={s.bulletRow}>
          <View style={s.bulletDot} />
          <Text style={s.bulletTxt}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: BG },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#0c0c0c', paddingTop: 58, paddingBottom: 16, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: BORDER },
  backBtn:      { width: 38, height: 38, borderRadius: 12, backgroundColor: CARD, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BORDER },
  backArrow:    { color: WHITE, fontSize: 18 },
  headerTitle:  { color: WHITE, fontSize: 17, fontWeight: '700' },
  scroll:       { padding: 20 },
  heroBadge:    { alignItems: 'center', paddingVertical: 28, marginBottom: 8 },
  heroEmoji:    { fontSize: 44, marginBottom: 12 },
  heroTitle:    { color: WHITE, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  heroSub:      { color: '#444', fontSize: 13 },
  section:      { marginBottom: 20 },
  sectionTitle: { color: ORANGE, fontSize: 13, fontWeight: '700', letterSpacing: 0.3, marginBottom: 10, textTransform: 'uppercase' },
  sectionBody:  { backgroundColor: CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: BORDER },
  para:         { color: '#888', fontSize: 13, lineHeight: 20, marginBottom: 8 },
  bulletList:   { marginBottom: 4 },
  bulletRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  bulletDot:    { width: 5, height: 5, borderRadius: 3, backgroundColor: ORANGE, marginTop: 7, flexShrink: 0 },
  bulletTxt:    { color: '#888', fontSize: 13, lineHeight: 20, flex: 1 },
})

