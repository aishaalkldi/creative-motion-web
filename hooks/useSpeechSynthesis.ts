'use client'

import { useCallback, useEffect, useState } from 'react'

function detectSpeechSynthesisSupport(): boolean {
  if (typeof window === 'undefined') return false
  return 'speechSynthesis' in window
}

export function useSpeechSynthesis() {
  const [mounted, setMounted] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    setIsSupported(detectSpeechSynthesisSupport())
    setMounted(true)
  }, [])

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

  return { mounted, isSupported, speak, stop }
}
