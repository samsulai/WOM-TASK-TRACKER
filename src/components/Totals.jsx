import { formatHours } from '../format'

const SEGMENT_COLORS = [
  'var(--seg-1)',
  'var(--seg-2)',
  'var(--seg-3)',
  'var(--seg-4)',
  'var(--seg-5)',
]

export default function Totals({ projectTotals, grandTotal }) {
  return (
    <section className="totals-card">
      <div className="totals-header">
        <div>
          <p className="eyebrow">This period</p>
          <h2>Totals by project</h2>
        </div>
        <div className="totals-grand">
          <span className="stat-value stat-value-lg">{formatHours(grandTotal)}</span>
          <span className="stat-caption">total logged</span>
        </div>
      </div>

      {projectTotals.length === 0 ? (
        <p className="empty-row">No hours logged yet — add a task to start the ledger.</p>
      ) : (
        <>
          <div className="ledger-bar" role="img" aria-label="Hours distribution by project">
            {projectTotals.map(([project, hours], i) => {
              const pct = grandTotal > 0 ? (hours / grandTotal) * 100 : 0
              if (pct === 0) return null
              return (
                <span
                  key={project}
                  className="ledger-segment"
                  title={`${project}: ${formatHours(hours)}`}
                  style={{
                    width: `${pct}%`,
                    background: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                  }}
                />
              )
            })}
          </div>

          <ul className="ledger-legend">
            {projectTotals.map(([project, hours], i) => {
              const pct = grandTotal > 0 ? (hours / grandTotal) * 100 : 0
              return (
                <li key={project}>
                  <span
                    className="ledger-dot"
                    style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                  />
                  <span className="ledger-name">{project}</span>
                  <span className="ledger-pct">{pct.toFixed(0)}%</span>
                  <span className="ledger-hours">{formatHours(hours)}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
