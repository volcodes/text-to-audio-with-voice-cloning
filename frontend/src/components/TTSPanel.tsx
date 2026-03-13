import { useEffect, useRef, useState } from 'react'
import { getGenerationStatus } from '../api/client'
import type { GenerationStatus } from '../api/client'
import { useVoiceClone } from '../hooks/useVoiceClone'
import AudioPlayer from './AudioPlayer'
import AnalyticsDashboard from './AnalyticsDashboard'

interface TTSPanelProps {
  voiceId: string
  appState: string
  onStateChange: (state: 'generating' | 'done' | 'registered') => void
}

export default function TTSPanel({ voiceId, onStateChange }: TTSPanelProps) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<GenerationStatus | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { generate, generating, generatedAudioUrl, error, generationRecord, generationHistory } =
    useVoiceClone()

  useEffect(() => {
    if (generating) {
      pollRef.current = setInterval(async () => {
        try {
          const s = await getGenerationStatus()
          setStatus(s)
        } catch {
          // ignore transient polling errors
        }
      }, 1500)
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      setStatus(null)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [generating])

  const handleGenerate = async () => {
    if (!text.trim()) return
    onStateChange('generating')
    const url = await generate(voiceId, text)
    onStateChange(url ? 'done' : 'registered')
  }

  const progressLabel = (() => {
    if (!generating) return 'Generate Speech'
    if (!status || !status.busy || status.total_chunks === 0) return 'Preparing…'
    if (status.total_chunks === 1) return 'Generating speech…'
    return `Chunk ${status.chunk} of ${status.total_chunks}…`
  })()

  const progressPct = (() => {
    if (!status || status.total_chunks === 0) return 0
    return Math.round(((status.chunk - 1) / status.total_chunks) * 100)
  })()

  const timerLabel = (() => {
    if (!generating || !status) return null
    const parts: string[] = []
    if (status.total_elapsed_ms != null)
      parts.push(`Total: ${(status.total_elapsed_ms / 1000).toFixed(1)}s`)
    if (status.chunk_elapsed_ms != null)
      parts.push(`Chunk: ${(status.chunk_elapsed_ms / 1000).toFixed(1)}s`)
    return parts.length > 0 ? parts.join(' | ') : null
  })()

  return (
    <>
      <div className="card">
        <h2>Generate Speech</h2>
        <textarea
          placeholder="Type the text you want spoken in your cloned voice..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div style={{ marginTop: '0.75rem' }}>
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={generating || !text.trim()}
          >
            {progressLabel}
          </button>
        </div>

        {generating && (
          <div style={{ marginTop: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                color: '#6b7280',
                marginBottom: '4px',
              }}
            >
              <span>{progressLabel}</span>
              <span>
                {timerLabel && (
                  <span style={{ marginRight: '0.5rem', fontFamily: 'monospace' }}>
                    {timerLabel}
                  </span>
                )}
                {status && status.total_chunks > 1 && <span>{progressPct}%</span>}
              </span>
            </div>
            <div
              style={{
                background: '#e5e7eb',
                borderRadius: '4px',
                height: '6px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  background: '#3b82f6',
                  height: '100%',
                  borderRadius: '4px',
                  width: status && status.total_chunks > 1 ? `${progressPct}%` : '100%',
                  transition: 'width 0.8s ease',
                  animation:
                    !status || status.total_chunks <= 1
                      ? 'pulse 1.5s ease-in-out infinite'
                      : undefined,
                }}
              />
            </div>
          </div>
        )}

        {error && <p className="error">{error}</p>}
        {generatedAudioUrl && <AudioPlayer src={generatedAudioUrl} label="Generated speech" />}
      </div>

      {generationRecord && (
        <AnalyticsDashboard record={generationRecord} history={generationHistory} />
      )}
    </>
  )
}
