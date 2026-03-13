import { useCallback, useState } from 'react'
import { registerVoice, generateSpeech, fetchLatestLog, fetchAllLogs } from '../api/client'
import type { GenerationRecord } from '../types/analytics'

interface VoiceCloneState {
  voiceId: string | null
  registering: boolean
  generating: boolean
  generatedAudioUrl: string | null
  error: string | null
  generationRecord: GenerationRecord | null
  generationHistory: GenerationRecord[]
}

export function useVoiceClone() {
  const [state, setState] = useState<VoiceCloneState>({
    voiceId: null,
    registering: false,
    generating: false,
    generatedAudioUrl: null,
    error: null,
    generationRecord: null,
    generationHistory: [],
  })

  const register = useCallback(async (audioBlob: Blob) => {
    setState((s) => ({ ...s, registering: true, error: null }))
    try {
      const { voice_id } = await registerVoice(audioBlob)
      setState((s) => ({ ...s, voiceId: voice_id, registering: false }))
      return voice_id
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Registration failed'
      setState((s) => ({ ...s, registering: false, error: msg }))
      return null
    }
  }, [])

  const generate = useCallback(async (voiceId: string, text: string) => {
    setState((s) => ({ ...s, generating: true, error: null }))
    try {
      const blob = await generateSpeech(voiceId, text)
      const url = URL.createObjectURL(blob)
      setState((s) => ({ ...s, generating: false, generatedAudioUrl: url }))
      try {
        const [record, history] = await Promise.all([fetchLatestLog(), fetchAllLogs()])
        setState((s) => ({ ...s, generationRecord: record, generationHistory: history }))
      } catch {
        // swallow analytics errors — non-fatal
      }
      return url
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Generation failed'
      setState((s) => ({ ...s, generating: false, error: msg }))
      return null
    }
  }, [])

  return { ...state, register, generate }
}
