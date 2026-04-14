import { useNavigate } from 'react-router-dom'
import { getReports } from '../utils/storage'
import { useMemo } from 'react'

export default function Home() {
  const navigate = useNavigate()
  const reports = getReports()

  const stats = useMemo(() => {
    if (!reports.length) return { avg: null, total: 0, stressed: 0, healthy: 0 }
    const avg = Math.round(reports.reduce((s, r) => s + r.health_score, 0) / reports.length)
    const stressed = reports.filter(r => r.stress_level === 'High' || r.stress_level === 'Critical').length
    const healthy = reports.filter(r => r.stress_level === 'Low').length
    return { avg, total: reports.length, stressed, healthy }
  }, [reports])

  const scoreColor = stats.avg == null ? '#27a065' : stats.avg >= 70 ? '#27a065' : stats.avg >= 40 ? '#e09d3f' : '#e24b4a'
  const scoreLabel = stats.avg == null ? '—' : stats.avg >= 70 ? 'Good' : stats.avg >= 40 ? 'Moderate' : 'Poor'
  const recent = reports.slice(-4).reverse()

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8 fade-up">
        <h1 className="font-display text-3xl font-bold text-forest-100 tracking-tight">Environmental Dashboard</h1>
        <p className="text-forest-600 mt-1 font-body text-sm">Monitor your neighborhood's plant health and pollution levels</p>
      </div>

      {/* Area Health Score */}
      <div className="fade-up-2 mb-6 rounded-2xl border border-forest-900 bg-[#0f1a13] p-6 flex items-center gap-8">
        <div className="relative w-28 h-28 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#1a2e20" strokeWidth="10"/>
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke={scoreColor} strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${stats.avg != null ? (stats.avg / 100) * 251 : 0} 251`}
              style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-2xl font-bold" style={{ color: scoreColor }}>
              {stats.avg ?? '—'}
            </span>
            <span className="text-xs text-forest-600">{scoreLabel}</span>
          </div>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold text-forest-200">Area Health Score</h2>
          <p className="text-forest-600 text-sm mt-1 max-w-sm">
            {stats.total === 0
              ? 'No scans yet. Upload your first plant photo to start monitoring!'
              : `Based on ${stats.total} scan${stats.total > 1 ? 's' : ''} in your area. ${stats.stressed > 0 ? `${stats.stressed} high-stress plant${stats.stressed > 1 ? 's' : ''} detected.` : 'All plants look healthy!'}`
            }
          </p>
          <button
            onClick={() => navigate('/scanner')}
            className="mt-3 px-4 py-2 rounded-lg bg-forest-500 text-white text-sm font-medium hover:bg-forest-400 transition-colors"
          >
            Scan a plant →
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="fade-up-3 grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Scans', value: stats.total, color: 'text-forest-300' },
          { label: 'Healthy Plants', value: stats.healthy, color: 'text-green-400' },
          { label: 'Stressed Plants', value: stats.stressed, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-forest-900 bg-[#0f1a13] p-4">
            <p className="text-xs text-forest-700 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`font-display text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent scans */}
      {recent.length > 0 && (
        <div className="fade-up-4">
          <h3 className="font-display text-sm font-semibold text-forest-500 uppercase tracking-wider mb-3">Recent Scans</h3>
          <div className="space-y-2">
            {recent.map((r, i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl border border-forest-900/60 bg-[#0f1a13]/60 px-4 py-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-forest-900">
                  {r.imageUrl && <img src={r.imageUrl} alt="" className="w-full h-full object-cover"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-forest-200 font-medium truncate">{r.plant_name}</p>
                  <p className="text-xs text-forest-700">{new Date(r.date).toLocaleDateString()}</p>
                </div>
                <StressBadge level={r.stress_level} />
                <span className="font-display text-lg font-bold text-forest-300">{r.health_score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {reports.length === 0 && (
        <div className="fade-up-4 rounded-2xl border border-dashed border-forest-900 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-forest-900/40 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#27a065" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
            </svg>
          </div>
          <p className="font-display text-forest-400 font-semibold">No scans yet</p>
          <p className="text-sm text-forest-700 mt-1">Head to the Leaf Scanner to get started</p>
        </div>
      )}
    </div>
  )
}

function StressBadge({ level }) {
  const cfg = {
    Low: 'bg-green-900/40 text-green-400 border-green-900',
    Moderate: 'bg-yellow-900/40 text-yellow-400 border-yellow-900',
    High: 'bg-red-900/40 text-red-400 border-red-900',
    Critical: 'bg-red-900/60 text-red-300 border-red-800',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg[level] || cfg.Moderate}`}>
      {level}
    </span>
  )
}
