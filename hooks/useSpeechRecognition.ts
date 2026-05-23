'use client'

import { useCallback, useRef, useState } from 'react'

export function useSpeechRecognition(lang: 'ar' | 'en') {
  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window ||
     'webkitSpeechRecognition' in window)

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)

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

  return { isSupported, isListening, transcript,
           startListening, stopListening }
}
