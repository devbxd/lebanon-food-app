import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Afficher les notifs même app ouverte
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export async function registerForPushNotifications(orderId) {
  if (!Device.isDevice) {
    console.warn('Push notifications ne marchent pas sur simulateur')
    return null
  }

  // Canaux Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('order-status', {
      name: 'Statut commande',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: true,
    })
    await Notifications.setNotificationChannelAsync('chat', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100],
      sound: true,
    })
  }

  // Demander permission iOS
  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.warn('Permission notifications refusée')
    return null
  }

  // Récupérer le token — projectId obligatoire sur iOS
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId

    if (!projectId) {
      console.error('projectId EAS manquant dans app.json/app.config.js')
      return null
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
    console.log('✅ Push token:', token)

    if (orderId) {
      await supabase
        .from('orders')
        .update({ push_token: token })
        .eq('id', orderId)
    }

    return token
  } catch (e) {
    console.error('Erreur token push:', e)
    return null
  }
}

export async function sendLocalNotif({ title, body, data = {}, channel = 'order-status' }) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data,
        ...(Platform.OS === 'android' ? { channelId: channel } : {}),
      },
      trigger: null,
    })
  } catch (e) {
    console.error('Erreur sendLocalNotif:', e)
  }
}

export const STATUS_MESSAGES = {
  preparing:  { title: '👨‍🍳 Commande acceptée !',      body: 'Le restaurant prépare ta commande.' },
  on_the_way: { title: '🛵 Ton livreur est en route !', body: 'Il arrive bientôt chez toi.' },
  delivered:  { title: '✅ Commande livrée !',            body: 'Bon appétit ! 🎉' },
  refused:    { title: '❌ Commande refusée',             body: 'Le restaurant a refusé ta commande.' },
}