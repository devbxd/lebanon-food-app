import { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { translations } from './i18n'

const STORAGE_KEY = 'app_language'
const DEFAULT_LANG = 'fr'

const LanguageContext = createContext({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key) => key,
  isLoading: true,
})

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && translations[saved]) {
        setLangState(saved)
      }
      setIsLoading(false)
    })
  }, [])

  async function setLang(newLang) {
    if (!translations[newLang]) return
    setLangState(newLang)
    await AsyncStorage.setItem(STORAGE_KEY, newLang)
  }

  // t('checkout.title') -> va chercher translations[lang].checkout.title
  // Supporte les variables : t('checkout.whishAlertMsg', { total: '12.50' })
  function t(key, vars = {}) {
    const parts = key.split('.')
    let value = translations[lang]
    for (const part of parts) {
      value = value?.[part]
    }
    if (value === undefined) {
      // Fallback français si la clé manque dans la langue active
      let fallback = translations.fr
      for (const part of parts) {
        fallback = fallback?.[part]
      }
      value = fallback ?? key
    }
    if (typeof value === 'string') {
      Object.keys(vars).forEach((varKey) => {
        value = value.replace(`%${varKey}%`, vars[varKey])
      })
    }
    return value
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isLoading }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  return useContext(LanguageContext)
}