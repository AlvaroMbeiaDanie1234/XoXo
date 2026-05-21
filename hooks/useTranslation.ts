'use client'

import { useState, useEffect, useCallback } from 'react'
import { translations, Language, TranslationKey } from '@/lib/translations'

const DEFAULT_LANG: Language = 'PT'

export function useTranslation() {
  const [lang, setLang] = useState<Language>(DEFAULT_LANG)

  // Initialize lang on client mount to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('xoxo_lang') as Language
      if (stored === 'PT' || stored === 'EN') {
        setLang(stored)
      } else {
        localStorage.setItem('xoxo_lang', DEFAULT_LANG)
      }
    }

    const handleLangChange = () => {
      const stored = localStorage.getItem('xoxo_lang') as Language
      if (stored === 'PT' || stored === 'EN') {
        setLang(stored)
      }
    }

    window.addEventListener('languageChanged', handleLangChange)
    return () => {
      window.removeEventListener('languageChanged', handleLangChange)
    }
  }, [])

  const changeLanguage = useCallback((newLang: Language) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('xoxo_lang', newLang)
      setLang(newLang)
      window.dispatchEvent(new Event('languageChanged'))
    }
  }, [])

  const t = useCallback((key: TranslationKey, replacements?: Record<string, string | number>): string => {
    const dict = translations[lang] || translations[DEFAULT_LANG]
    let text = dict[key] || translations[DEFAULT_LANG][key] || key

    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v))
      })
    }

    return text
  }, [lang])

  return { t, lang, changeLanguage }
}
