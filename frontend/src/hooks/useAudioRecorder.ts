import { useCallback, useRef, useState } from 'react'

export interface AudioRecorderState {
  isRecording: boolean
  elapsed: number
  audioBlob: Blob | null
  audioUrl: string | null
  error: string | null
}

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    elapsed: 0,
    audioBlob: null,
    audioUrl: null,
    error: null,
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setState((s) => ({ ...s, isRecording: false, audioBlob: blob, audioUrl: url }))
        stream.getTracks().forEach((t) => t.stop())
      }

      mediaRecorder.start(250)
      startTimeRef.current = Date.now()

      timerRef.current = setInterval(() => {
        setState((s) => ({ ...s, elapsed: Math.floor((Date.now() - startTimeRef.current) / 1000) }))
      }, 500)

      setState({ isRecording: true, elapsed: 0, audioBlob: null, audioUrl: null, error: null })
    } catch {
      setState((s) => ({ ...s, error: 'Microphone access denied' }))
    }
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl)
    setState({ isRecording: false, elapsed: 0, audioBlob: null, audioUrl: null, error: null })
  }, [state.audioUrl])

  return { ...state, startRecording, stopRecording, reset }
}
