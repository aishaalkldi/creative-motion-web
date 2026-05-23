'use client'

import { useCallback } from 'react'

export function useSpeechSynthesis() {
  const isSupported = typeof window !== 'undefined' &&
    'speechSynthesis' in window

  const speak = useCallback((text: string, lang: 'ar' | 'en') => {
    if (!isSupported) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang === 'ar' ? 'ar-SA' : 'en-US'
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }, [isSupported])

  const stop = useCallback(() => {
    if (isSupported) window.speechSynthesis.cancel()
  }, [isSupported])

  return { isSupported, speak, stop }
}
