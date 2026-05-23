'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

function detectSpeechRecognitionSupport(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as Window & typeof globalThis & {
    SpeechRecognition?: unknown
    webkitSpeechRecognition?: unknown
  }
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}

export function useSpeechRecognition(lang: 'ar' | 'en') {
  const [mounted, setMounted] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    setIsSupported(detectSpeechRecognitionSupport())
    setMounted(true)
  }, [])

  const startListening = useCallback(() => {
    if (!isSupported) return

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    const recognition = new SpeechRecognition()
    recognition.lang = lang === 'ar' ? 'ar-SA' : 'en-US'
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      setTranscript(result[0].transcript)
    }

    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognitionRef.current = recognition
    setTranscript('')
    recognition.start()
    setIsListening(true)
  }, [lang, isSupported])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  return { mounted, isSupported, isListening, transcript,
           startListening, stopListening }
}
