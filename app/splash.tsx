import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'

const { width, height } = Dimensions.get('window')

export default function SplashScreen() {
  const router = useRouter()

  const mouthOpen = useRef(new Animated.Value(0)).current
  const zoomScale = useRef(new Animated.Value(1)).current
  const zoomY     = useRef(new Animated.Value(0)).current
  const opacity   = useRef(new Animated.Value(1)).current
  const chefScale = useRef(new Animated.Value(0.7)).current
  const chefOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(chefScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
      Animated.timing(chefOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(mouthOpen, { toValue: 1, duration: 500, useNativeDriver: false }),
          Animated.delay(300),
          Animated.parallel([
            Animated.timing(zoomScale, { toValue: 12, duration: 700, useNativeDriver: true }),
            Animated.timing(zoomY,     { toValue: 80, duration: 700, useNativeDriver: true }),
            Animated.timing(opacity,   { toValue: 0,  duration: 600, useNativeDriver: true }),
          ]),
        ]).start(() => {
          // Récupère la session au moment exact de la redirection
          supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
              router.replace('/(tabs)')
            } else {
              router.replace('/login')
            }
          })
        })
      }, 600)
    })
  }, [])

  const mouthHeight = mouthOpen.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '55%'],
  })

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Animated.View style={[
        styles.sceneWrap,
        {
          transform: [
            { scale: zoomScale },
            { translateY: zoomY },
          ],
        },
      ]}>
        <Animated.View style={[styles.chef, { opacity: chefOpacity, transform: [{ scale: chefScale }] }]}>
          <View style={styles.toqueBase} />
          <View style={styles.toqueTall} />
          <View style={[styles.toqueBand, { top: 62 }]} />
          <View style={[styles.toqueBand, { top: 72 }]} />
          <View style={styles.face}>
            <View style={styles.eyesRow}>
              <View style={styles.eye}>
                <View style={styles.pupil} />
                <View style={styles.eyeShine} />
              </View>
              <View style={styles.eye}>
                <View style={styles.pupil} />
                <View style={styles.eyeShine} />
              </View>
            </View>
            <View style={[styles.eyebrow, { left: 28 }]} />
            <View style={[styles.eyebrow, { right: 28 }]} />
            <View style={styles.nose} />
            <View style={[styles.cheek, { left: 14 }]} />
            <View style={[styles.cheek, { right: 14 }]} />
            <View style={styles.mouthWrap}>
              <View style={styles.lips} />
              <Animated.View style={[styles.mouthInner, { height: mouthHeight }]}>
                <View style={styles.uvula} />
                <View style={styles.teeth} />
              </Animated.View>
            </View>
          </View>
          <View style={styles.body}>
            <View style={styles.bodyStripe} />
            <View style={[styles.bodyStripe, { top: 18 }]} />
            <View style={[styles.button, { top: 8,  left: '48%' }]} />
            <View style={[styles.button, { top: 26, left: '48%' }]} />
            <View style={[styles.button, { top: 44, left: '48%' }]} />
          </View>
          <View style={styles.mustacheWrap}>
            <View style={[styles.mustachePart, { transform: [{ rotate: '-15deg' }] }]} />
            <View style={[styles.mustachePart, { transform: [{ rotate: '15deg' }]  }]} />
          </View>
        </Animated.View>
        <View style={styles.shadow} />
      </Animated.View>

      <Animated.Text style={[styles.appName, { opacity: chefOpacity }]}>
        HUNGRYYY<Animated.Text style={styles.appNameAccent}></Animated.Text>
      </Animated.Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  sceneWrap: { alignItems: 'center', justifyContent: 'center' },
  chef: { alignItems: 'center', width: 180 },
  toqueBase: { width: 130, height: 22, backgroundColor: '#fff', borderRadius: 6, marginBottom: -4, zIndex: 2, borderWidth: 1.5, borderColor: '#ddd' },
  toqueTall: { width: 100, height: 80, backgroundColor: '#fff', borderRadius: 50, borderWidth: 1.5, borderColor: '#ddd', zIndex: 1 },
  toqueBand: { position: 'absolute', width: 130, height: 3, backgroundColor: '#FF6B35', borderRadius: 2, zIndex: 3 },
  face: { width: 160, height: 160, backgroundColor: '#FFDAB9', borderRadius: 80, borderWidth: 2, borderColor: '#e8b89a', alignItems: 'center', overflow: 'hidden', marginTop: -10, zIndex: 4 },
  eyesRow: { flexDirection: 'row', gap: 36, marginTop: 44, marginBottom: 6 },
  eye: { width: 26, height: 26, backgroundColor: '#fff', borderRadius: 13, borderWidth: 1.5, borderColor: '#ccc', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pupil: { width: 14, height: 14, backgroundColor: '#222', borderRadius: 7 },
  eyeShine: { position: 'absolute', top: 4, right: 4, width: 5, height: 5, backgroundColor: '#fff', borderRadius: 3 },
  eyebrow: { position: 'absolute', top: 34, width: 28, height: 5, backgroundColor: '#8B4513', borderRadius: 3 },
  nose: { width: 14, height: 10, backgroundColor: '#e8a882', borderRadius: 7, marginBottom: 6 },
  cheek: { position: 'absolute', bottom: 40, width: 30, height: 18, backgroundColor: '#FFB6A0', borderRadius: 15, opacity: 0.5 },
  mustacheWrap: { position: 'absolute', bottom: 52, flexDirection: 'row', gap: 4, zIndex: 5 },
  mustachePart: { width: 28, height: 10, backgroundColor: '#5C3317', borderRadius: 8 },
  mouthWrap: { width: 70, height: 40, backgroundColor: '#c0614a', borderRadius: 35, overflow: 'hidden', borderWidth: 1.5, borderColor: '#a04030', alignItems: 'center' },
  lips: { width: 70, height: 12, backgroundColor: '#c0614a', zIndex: 2 },
  mouthInner: { width: 60, backgroundColor: '#1a0000', borderRadius: 30, alignItems: 'center', overflow: 'hidden' },
  teeth: { width: 60, height: 10, backgroundColor: '#fff', borderRadius: 5, marginTop: 2 },
  uvula: { width: 12, height: 18, backgroundColor: '#c05070', borderRadius: 6, marginTop: 8 },
  body: { width: 140, height: 80, backgroundColor: '#fff', borderRadius: 14, borderWidth: 2, borderColor: '#ddd', marginTop: 4, overflow: 'hidden' },
  bodyStripe: { position: 'absolute', top: 6, left: 0, right: 0, height: 3, backgroundColor: '#FF6B35', opacity: 0.25 },
  button: { position: 'absolute', width: 8, height: 8, backgroundColor: '#FF6B35', borderRadius: 4 },
  shadow: { width: 120, height: 12, backgroundColor: '#000', borderRadius: 60, opacity: 0.15, marginTop: 6 },
  appName: { position: 'absolute', bottom: 100, fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  appNameAccent: { color: '#FF6B35' },
})

