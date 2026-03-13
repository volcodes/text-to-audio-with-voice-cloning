import { useState } from 'react'
import './App.css'
import TextDisplay from './components/TextDisplay'
import RecordingPanel from './components/RecordingPanel'
import PreRecordedVoicePanel from './components/PreRecordedVoicePanel'
import TTSPanel from './components/TTSPanel'

type AppState = 'idle' | 'recording' | 'registered' | 'generating' | 'done'

export default function App() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [voiceId, setVoiceId] = useState<string | null>(null)

  const handleVoiceRegistered = (id: string) => {
    setVoiceId(id)
    setAppState('registered')
  }

  return (
    <div className="app">
      <header className="app-header">
        <img src="/logo.png" alt="Text-to-Audio with Voice Cloning" className="app-logo" />
      </header>

      <TextDisplay />

      <RecordingPanel
        onStateChange={setAppState}
        onVoiceRegistered={handleVoiceRegistered}
      />

      <div className="or-divider">or</div>

      <PreRecordedVoicePanel onVoiceRegistered={handleVoiceRegistered} />

      {voiceId && (
        <TTSPanel
          voiceId={voiceId}
          appState={appState}
          onStateChange={setAppState}
        />
      )}
    </div>
  )
}
