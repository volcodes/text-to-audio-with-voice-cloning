export interface ChunkLog {
  index: number
  text_preview: string
  char_count: number
  duration_ms: number
  audio_duration_s: number
}

export interface GenerationRecord {
  id: string
  timestamp: string
  voice_id: string
  total_chars: number
  chunk_count: number
  total_duration_ms: number
  audio_duration_s: number
  device: string
  chunks: ChunkLog[]
}
