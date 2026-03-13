interface AudioPlayerProps {
  src: string
  label?: string
}

export default function AudioPlayer({ src, label }: AudioPlayerProps) {
  return (
    <div style={{ marginTop: '0.75rem' }}>
      {label && <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>{label}</p>}
      <audio controls src={src} style={{ width: '100%' }} />
    </div>
  )
}
