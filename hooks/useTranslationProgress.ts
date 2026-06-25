'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type FieldTranslationState =
  | 'idle'
  | 'loading'
  | 'done'
  | 'failed'
  | 'cached'

export function useTranslationProgress(
  assessmentId: string,
  arabicFields: { fieldKey: string; text: string }[],
  existingTranslations: Record<string, string>,
  existingGeneratedAt: Record<string, string> = {},
  options?: { autoTranslate?: boolean },
) {
  const initialStates: Record<string, FieldTranslationState> = Object.fromEntries(
    arabicFields.map((f) => [
      f.fieldKey,
      existingTranslations[`${f.fieldKey}_en`] ? 'cached' : 'idle',
    ]),
  )

  const [states, setStates] = useState<Record<string, FieldTranslationState>>(initialStates)
  const [translations, setTranslations] = useState<Record<string, string>>(
    Object.fromEntries(
      arabicFields
        .filter((f) => existingTranslations[`${f.fieldKey}_en`])
        .map((f) => [f.fieldKey, existingTranslations[`${f.fieldKey}_en`]]),
    ),
  )
  const [generatedAtMap, setGeneratedAtMap] = useState<Record<string, string>>(
    Object.fromEntries(
      arabicFields
        .filter((f) => existingTranslations[`${f.fieldKey}_en`])
        .map((f) => [f.fieldKey, existingGeneratedAt[f.fieldKey] ?? '']),
    ),
  )

  const translateField = useCallback(
    async (fieldKey: string, text: string) => {
      setStates((prev) => ({ ...prev, [fieldKey]: 'loading' }))

      try {
        const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldKey, text }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          translation?: string
          generatedAt?: string
        }
        if (!res.ok || !data.translation?.trim()) {
          throw new Error('API error')
        }
        setTranslations((prev) => ({
          ...prev,
          [fieldKey]: data.translation!.trim(),
        }))
        if (data.generatedAt) {
          setGeneratedAtMap((prev) => ({ ...prev, [fieldKey]: data.generatedAt! }))
        }
        setStates((prev) => ({ ...prev, [fieldKey]: 'done' }))
      } catch {
        setStates((prev) => ({ ...prev, [fieldKey]: 'failed' }))
      }
    },
    [assessmentId],
  )

  const translateAll = useCallback(async () => {
    const toTranslate = arabicFields.filter(
      (f) => states[f.fieldKey] === 'idle' || states[f.fieldKey] === 'failed',
    )
    await Promise.allSettled(
      toTranslate.map((f) => translateField(f.fieldKey, f.text)),
    )
  }, [arabicFields, states, translateField])

  const autoTranslateStarted = useRef(false)
  useEffect(() => {
    if (!options?.autoTranslate || !assessmentId || autoTranslateStarted.current) return
    const pending = arabicFields.filter((f) => !existingTranslations[`${f.fieldKey}_en`])
    if (pending.length === 0) return
    autoTranslateStarted.current = true
    void Promise.allSettled(
      pending.map((f) => translateField(f.fieldKey, f.text)),
    )
  }, [options?.autoTranslate, assessmentId, arabicFields, existingTranslations, translateField])

  const doneCount = Object.values(states).filter(
    (s) => s === 'done' || s === 'cached',
  ).length
  const totalCount = arabicFields.length
  const allTranslated = totalCount > 0 && doneCount === totalCount
  const anyLoading = Object.values(states).some((s) => s === 'loading')

  return {
    states,
    translations,
    generatedAtMap,
    translateField,
    translateAll,
    doneCount,
    totalCount,
    allTranslated,
    anyLoading,
  }
}
