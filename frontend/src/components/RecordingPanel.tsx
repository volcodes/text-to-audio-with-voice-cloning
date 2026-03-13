import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useVoiceClone } from '../hooks/useVoiceClone'
import AudioPlayer from './AudioPlayer'

interface RecordingPanelProps {
  onStateChange: (state: 'idle' | 'recording') => void
  onVoiceRegistered: (voiceId: string) => void
}

export default function RecordingPanel({ onStateChange, onVoiceRegistered }: RecordingPanelProps) {
  const recorder = useAudioRecorder()
  const { register, registering, voiceId: registeredId, error } = useVoiceClone()

  const handleStart = () => {
    recorder.startRecording()
    onStateChange('recording')
  }

  const handleStop = () => {
    recorder.stopRecording()
    onStateChange('idle')
  }

  const handleSubmit = async () => {
    if (!recorder.audioBlob) return
    const voiceId = await register(recorder.audioBlob)
    if (voiceId) {
      onVoiceRegistered(voiceId)
    }
  }

  const handleReRecord = () => {
    recorder.reset()
    onStateChange('idle')
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="card">
      <h2>Record Your Voice</h2>

      {recorder.isRecording ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-danger" onClick={handleStop}>
            Stop Recording
          </button>
          <span style={{ fontSize: '1.2rem', fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(recorder.elapsed)}
          </span>
          <span style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#ef233c',
            animation: 'pulse 1s infinite',
          }} />
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
        </div>
      ) : recorder.audioBlob ? (
        <div>
          <AudioPlayer src={recorder.audioUrl!} label="Preview your recording" />
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={registering || !!registeredId}
            >
              {registering ? 'Submitting...' : registeredId ? 'Registered' : 'Submit Voice'}
            </button>
            <button onClick={handleReRecord} disabled={registering}>
              Re-record
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-primary" onClick={handleStart}>
          Start Recording
        </button>
      )}

      {recorder.error && <p className="error">{recorder.error}</p>}
      {error && <p className="error">{error}</p>}
      {registeredId && <p className="success">Voice registered successfully!</p>}
    </div>
  )
}
