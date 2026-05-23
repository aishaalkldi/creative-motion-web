'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export type TranscriptError =
  | 'voice_corrupted'
  | 'not_supported'
  | 'permission_denied'
  | 'no_speech'
  | null

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
  const [transcriptError, setTranscriptError] =
    useState<TranscriptError>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    setIsSupported(detectSpeechRecognitionSupport())
    setMounted(true)
  }, [])

  useEffect(() => {
    if (transcriptError !== 'voice_corrupted') return
    const id = setTimeout(() => setTranscriptError(null), 5000)
    return () => clearTimeout(id)
  }, [transcriptError])

  const startListening = useCallback(() => {
    if (!isSupported) {
      setTranscriptError('not_supported')
      return
    }

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    const recognition = new SpeechRecognitionClass()

    recognition.lang = lang === 'ar' ? 'ar-SA' : 'en-US'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      const raw = result[0].transcript ?? ''

      if (lang === 'ar' && raw.length > 0) {
        const hasArabic = [...raw].some(c => {
          const code = c.charCodeAt(0)
          return code >= 0x0600 && code <= 0x06FF
        })
        const hasQuestionMarks = raw.includes('?') ||
          raw.includes('\uFFFD')
        const isCorrupted = !hasArabic && hasQuestionMarks

        if (isCorrupted) {
          setTranscriptError('voice_corrupted')
          setTranscript('')
          setIsListening(false)
          return
        }
      }

      setTranscriptError(null)
      setTranscript(raw)
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setTranscriptError('permission_denied')
      } else if (event.error === 'no-speech') {
        setTranscriptError('no_speech')
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
    setTranscriptError(null)

  }, [lang, isSupported])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const clearTranscript = useCallback(() => {
    setTranscript('')
    setTranscriptError(null)
  }, [])

  return {
    mounted,
    isSupported,
    isListening,
    transcript,
    transcriptError,
    startListening,
    stopListening,
    clearTranscript,
  }
}
