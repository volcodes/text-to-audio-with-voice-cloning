import type { GenerationRecord } from '../types/analytics'

const BASE = '/api'

export interface GenerationStatus {
  busy: boolean
  chunk: number
  total_chunks: number
  total_elapsed_ms?: number
  chunk_elapsed_ms?: number
}

export async function registerVoice(audioBlob: Blob, filename = 'recording.webm'): Promise<{ voice_id: string; duration: number }> {
  const form = new FormData()
  form.append('file', audioBlob, filename)

  const res = await fetch(`${BASE}/voice/register`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Voice registration failed')
  }

  return res.json()
}

export async function generateSpeech(voiceId: string, text: string): Promise<Blob> {
  // Start generation (returns 202 immediately)
  const startRes = await fetch(`${BASE}/tts/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_id: voiceId, text }),
  })

  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({ detail: startRes.statusText }))
    throw new Error(err.detail || 'Speech generation failed')
  }

  // Poll status until generation finishes
  while (true) {
    await new Promise<void>((resolve) => setTimeout(resolve, 2000))
    const status = await getGenerationStatus()
    if (!status.busy) break
  }

  // Fetch the completed audio
  const resultRes = await fetch(`${BASE}/tts/result`)
  if (!resultRes.ok) {
    const err = await resultRes.json().catch(() => ({ detail: resultRes.statusText }))
    throw new Error(err.detail || 'Failed to retrieve audio')
  }
  return resultRes.blob()
}

export async function getGenerationStatus(): Promise<GenerationStatus> {
  const res = await fetch(`${BASE}/tts/status`)
  if (!res.ok) throw new Error('Failed to get status')
  return res.json()
}

export async function fetchLatestLog(): Promise<GenerationRecord> {
  const res = await fetch(`${BASE}/tts/logs/latest`)
  if (!res.ok) throw new Error('Failed to fetch latest log')
  return res.json()
}

export async function fetchAllLogs(): Promise<GenerationRecord[]> {
  const res = await fetch(`${BASE}/tts/logs`)
  if (!res.ok) throw new Error('Failed to fetch logs')
  return res.json()
}
