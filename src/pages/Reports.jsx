import { useState } from 'react'
import { getReports, deleteReport, clearReports } from '../utils/storage'

export default function Reports() {
  const [reports, setReports]   = useState(getReports)
  const [filter, setFilter]     = useState('All')
  const [hoverId, setHoverId]   = useState(null)

  const levels   = ['All', 'Low', 'Moderate', 'High', 'Critical']
  const filtered = filter === 'All' ? reports : reports.filter(r => r.stress_level === filter)
  const sorted   = [...filtered].reverse()

  const stressCfg = {
    Low:      'bg-green-900/40 text-green-400 border-green-900',
    Moderate: 'bg-yellow-900/40 text-yellow-400 border-yellow-900',
    High:     'bg-red-900/40 text-red-400 border-red-900',
    Critical: 'bg-red-900/60 text-red-300 border-red-800',
  }
  const scoreColor = s => s >= 70 ? '#27a065' : s >= 40 ? '#e09d3f' : '#e24b4a'

  function handleDelete(id) {
    deleteReport(id)
    setReports(getReports())
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6 fade-up flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-forest-100 tracking-tight">Reports</h1>
          <p className="text-forest-600 mt-1 text-sm">All plant scan history stored locally</p>
        </div>
        {reports.length > 0 && (
          <button
            onClick={() => { clearReports(); setReports([]) }}
            className="text-xs text-red-600 hover:text-red-400 border border-red-900/40 hover:border-red-800 px-3 py-1.5 rounded-lg transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="fade-up-2 flex gap-2 mb-5 flex-wrap">
        {levels.map(l => (
          <button key={l} onClick={() => setFilter(l)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === l
                ? 'bg-forest-500 text-white border-forest-500'
                : 'border-forest-900 text-forest-600 hover:text-forest-400 hover:border-forest-700'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="fade-up-3 rounded-2xl border border-dashed border-forest-900 p-12 text-center">
          <p className="text-forest-700 text-sm">No reports found. Start scanning plants!</p>
        </div>
      )}

      <div className="fade-up-3 space-y-3">
        {sorted.map((r) => {
          const uid = r.id ?? r.date
          return (
            <div
              key={uid}
              className="relative rounded-xl border border-forest-900/60 bg-[#0f1a13] overflow-hidden"
              onMouseEnter={() => setHoverId(uid)}
              onMouseLeave={() => setHoverId(null)}
            >
              {/* Hover delete button */}
              <button
                onClick={() => handleDelete(r.id)}
                className={`absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                  text-xs font-medium border border-red-900/60 bg-[#0f1a13]
                  text-red-500 hover:text-red-300 hover:border-red-700 hover:bg-red-950/40
                  transition-all duration-150 ${
                    hoverId === uid ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
                Delete
              </button>

              <div className="flex items-start gap-4 p-4">
                {r.imageUrl && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={r.imageUrl} alt="" className="w-full h-full object-cover"/>
                  </div>
                )}
                <div className="flex-1 min-w-0 pr-20">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display font-semibold text-forest-200 text-sm">{r.plant_name}</p>
                      <p className="text-xs text-forest-700 mt-0.5">{new Date(r.date).toLocaleString()}</p>
                      {r.location && (
                        <p className="text-xs text-forest-600 mt-0.5 flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                          </svg>
                          {r.location.name || `${r.location.latitude?.toFixed(4)}, ${r.location.longitude?.toFixed(4)}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${stressCfg[r.stress_level] || stressCfg.Moderate}`}>
                        {r.stress_level}
                      </span>
                      <span className="font-display text-xl font-bold" style={{ color: scoreColor(r.health_score) }}>
                        {r.health_score}
                      </span>
                    </div>
                  </div>
                  {r.eco_health_note && (
                    <p className="text-xs text-forest-600 mt-2 leading-relaxed">{r.eco_health_note}</p>
                  )}
                  {r.pollution_indicators?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.pollution_indicators.slice(0, 3).map((ind, j) => (
                        <span key={j} className="text-xs px-2 py-0.5 rounded-full bg-forest-900/40 text-forest-600 border border-forest-900/60">{ind}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {r.fix_it_tips?.length > 0 && (
                <div className="border-t border-forest-900/40 px-4 py-3 bg-forest-900/10">
                  <p className="text-xs text-forest-700 mb-1.5 uppercase tracking-wider">Tips</p>
                  <ul className="space-y-1">
                    {r.fix_it_tips.map((t, j) => (
                      <li key={j} className="text-xs text-forest-500 flex items-start gap-1.5">
                        <span className="text-forest-600 mt-0.5">→</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}