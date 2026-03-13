import { useState } from 'react'
import type { GenerationRecord } from '../types/analytics'

interface Props {
  record: GenerationRecord
  history: GenerationRecord[]
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function chunkColor(ms: number, maxMs: number): string {
  const ratio = maxMs > 0 ? ms / maxMs : 0
  const hue = Math.round(120 * (1 - ratio))
  return `hsl(${hue}, 70%, 45%)`
}

export default function AnalyticsDashboard({ record, history }: Props) {
  const [expanded, setExpanded] = useState(true)

  const throughput = Math.round(record.total_chars / (record.total_duration_ms / 1000))
  const rtf = (record.total_duration_ms / 1000 / record.audio_duration_s).toFixed(2)
  const maxChunkMs = Math.max(...record.chunks.map((c) => c.duration_ms), 1)

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div className="analytics-header">
        <span className="section-title">Generation Analytics</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span className="analytics-badge">#{record.id}</span>
          <span className="analytics-badge">{record.device.toUpperCase()}</span>
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{
              background: 'none',
              border: '1px solid #ddd',
              padding: '2px 8px',
              fontSize: '0.8rem',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {expanded ? '▲ Collapse' : '▼ Expand'}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Stat Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{formatMs(record.total_duration_ms)}</div>
              <div className="stat-label">Total Time</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{throughput}</div>
              <div className="stat-label">chars/sec</div>
              <div className="stat-sub">Throughput</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{rtf}×</div>
              <div className="stat-label">Real-Time Factor</div>
              <div className="stat-sub">{parseFloat(rtf) < 1 ? 'faster than realtime' : 'slower than realtime'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{record.audio_duration_s.toFixed(1)}s</div>
              <div className="stat-label">Audio Output</div>
            </div>
          </div>

          {/* Bar Chart — Chunk Timing Breakdown */}
          {record.chunks.length > 0 && (
            <div style={{ marginTop: '1.25rem' }}>
              <div className="section-title" style={{ marginBottom: '0.5rem' }}>
                Chunk Timing Breakdown
              </div>
              {record.chunks.map((chunk) => (
                <div key={chunk.index} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', minWidth: '55px' }}>
                      Chunk {chunk.index + 1}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        background: '#f3f4f6',
                        borderRadius: '4px',
                        height: '18px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${(chunk.duration_ms / maxChunkMs) * 100}%`,
                          height: '100%',
                          background: chunkColor(chunk.duration_ms, maxChunkMs),
                          borderRadius: '4px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: '#374151',
                        minWidth: '50px',
                        textAlign: 'right',
                      }}
                    >
                      {formatMs(chunk.duration_ms)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: '#9ca3af',
                      paddingLeft: '55px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {chunk.text_preview}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chunk Details Table */}
          <div style={{ marginTop: '1.25rem' }}>
            <div className="section-title" style={{ marginBottom: '0.5rem' }}>
              Chunk Details
            </div>
            <div className="chunk-table-wrap">
              <table className="chunk-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Text Preview</th>
                    <th>Chars</th>
                    <th>Time</th>
                    <th>Audio</th>
                    <th>c/s</th>
                  </tr>
                </thead>
                <tbody>
                  {record.chunks.map((chunk) => (
                    <tr key={chunk.index}>
                      <td>{chunk.index + 1}</td>
                      <td
                        style={{
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {chunk.text_preview}
                      </td>
                      <td>{chunk.char_count}</td>
                      <td>{formatMs(chunk.duration_ms)}</td>
                      <td>{chunk.audio_duration_s.toFixed(1)}s</td>
                      <td>{Math.round(chunk.char_count / (chunk.duration_ms / 1000))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Generation History */}
          {history.length > 1 && (
            <div style={{ marginTop: '1.25rem' }}>
              <div className="section-title" style={{ marginBottom: '0.5rem' }}>
                Generation History
              </div>
              <div className="history-list">
                {history
                  .slice(-5)
                  .reverse()
                  .map((h) => (
                    <div
                      key={h.id}
                      className={`history-item${h.id === record.id ? ' history-item--current' : ''}`}
                    >
                      <span className="analytics-badge">#{h.id}</span>
                      <span>{h.total_chars} chars</span>
                      <span>
                        {h.chunk_count} chunk{h.chunk_count !== 1 ? 's' : ''}
                      </span>
                      <span>{formatMs(h.total_duration_ms)}</span>
                      <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{h.device}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
