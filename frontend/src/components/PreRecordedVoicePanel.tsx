import { useState } from 'react'
import { registerVoice } from '../api/client'
import femaleSampleUrl from '../../pre-recorded-voices/Female Sample.wav?url'
import maleSampleUrl from '../../pre-recorded-voices/Male Sample.wav?url'

const VOICES = [
  { label: 'Female Sample', url: femaleSampleUrl, filename: 'Female Sample.wav' },
  { label: 'Male Sample', url: maleSampleUrl, filename: 'Male Sample.wav' },
]

interface PreRecordedVoicePanelProps {
  onVoiceRegistered: (voiceId: string) => void
}

export default function PreRecordedVoicePanel({ onVoiceRegistered }: PreRecordedVoicePanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUseVoice = async () => {
    const voice = VOICES[selectedIndex]
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(voice.url)
      if (!response.ok) throw new Error('Failed to load voice file')
      const blob = await response.blob()
      const { voice_id } = await registerVoice(blob, voice.filename)
      onVoiceRegistered(voice_id)
      setRegistered(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to register voice')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectionChange = (index: number) => {
    setSelectedIndex(index)
    setRegistered(false)
    setError(null)
  }

  return (
    <div className="card">
      <h2>Use a Pre-recorded Voice</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <select
          className="voice-select"
          value={selectedIndex}
          onChange={(e) => handleSelectionChange(Number(e.target.value))}
          disabled={loading}
        >
          {VOICES.map((voice, i) => (
            <option key={voice.filename} value={i}>{voice.label}</option>
          ))}
        </select>
        <button
          className="btn-primary"
          onClick={handleUseVoice}
          disabled={loading || registered}
        >
          {loading ? 'Loading...' : registered ? 'Registered' : 'Use This Voice'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {registered && <p className="success">Voice registered successfully!</p>}
    </div>
  )
}
