import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { getReports } from '../utils/storage'

export default function EcoMap() {
  const mapRef          = useRef(null)
  const mapInstance     = useRef(null)
  const clusterGroupRef = useRef(null)
  const [reports, setReports]           = useState(getReports)
  const [selectedGroup, setSelectedGroup] = useState(null)

  // ── Live refresh: poll localStorage every 2s so new scans appear instantly ──
  useEffect(() => {
    const interval = setInterval(() => setReports(getReports()), 2000)
    return () => clearInterval(interval)
  }, [])

  // ── Init map once ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapInstance.current) return
    import('leaflet').then(L => {
      const map = L.map(mapRef.current, { center: [22.3039, 70.8022], zoom: 13 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map)
      mapInstance.current = map
    })
    return () => {
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null }
    }
  }, [])

  // ── Rebuild markers whenever reports change ──────────────────────────────────
  useEffect(() => {
    if (!mapInstance.current) return
    Promise.all([import('leaflet'), import('leaflet.markercluster')]).then(([L]) => {
      // Remove old cluster group
      if (clusterGroupRef.current) {
        mapInstance.current.removeLayer(clusterGroupRef.current)
      }

      const group = L.markerClusterGroup({
        maxClusterRadius: 60,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false, // we handle clicks ourselves
        iconCreateFunction: (cluster) => {
          const children = cluster.getAllChildMarkers()
          const avg = children.reduce((s, m) => s + (m.options.reportData?.health_score || 50), 0) / children.length
          const color = avg >= 70 ? '#27a065' : avg >= 40 ? '#e09d3f' : '#e24b4a'
          const count = children.length
          const size = count > 99 ? 52 : count > 9 ? 44 : 36
          return L.divIcon({
            html: `<div style="
              background:${color}20;border:2px solid ${color};color:${color};
              width:${size}px;height:${size}px;border-radius:50%;
              display:flex;align-items:center;justify-content:center;
              font-size:${count > 9 ? 12 : 13}px;font-weight:700;font-family:monospace;
              box-shadow:0 0 0 4px ${color}15;
            ">${count}</div>`,
            className: '',
            iconSize: [size, size],
          })
        },
      })

      // Cluster click → show all reports in side panel
      group.on('clusterclick', (e) => {
        const groupReports = e.layer.getAllChildMarkers().map(m => m.options.reportData)
        setSelectedGroup(groupReports)
      })

      // Add markers
      reports.forEach(r => {
        if (!r.lat || !r.lng) return
        const color = r.health_score >= 70 ? '#27a065' : r.health_score >= 40 ? '#e09d3f' : '#e24b4a'
        const marker = L.circleMarker([r.lat, r.lng], {
          radius: 9, fillColor: color, color: color,
          weight: 2, opacity: 0.9, fillOpacity: 0.6,
          reportData: r,  // attach report to marker for retrieval
        })
        marker.on('click', () => setSelectedGroup([r]))
        group.addLayer(marker)
      })

      group.addTo(mapInstance.current)
      clusterGroupRef.current = group
    })
  }, [reports])

  const hasLocation = reports.some(r => r.lat && r.lng)
  const scoreColor  = s => s >= 70 ? '#27a065' : s >= 40 ? '#e09d3f' : '#e24b4a'
  const stressClass = { Low: 'text-green-400', Moderate: 'text-yellow-400', High: 'text-red-400', Critical: 'text-red-300' }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6 fade-up">
        <h1 className="font-display text-3xl font-bold text-forest-100 tracking-tight">Eco Map</h1>
        <p className="text-forest-600 mt-1 text-sm">Crowdsourced map of plant health across your neighborhood</p>
      </div>

      <div className="fade-up-2 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-forest-900 h-96 lg:h-[500px]" ref={mapRef}/>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Legend */}
          <div className="rounded-2xl border border-forest-900 bg-[#0f1a13] p-4">
            <p className="font-display text-xs font-semibold text-forest-500 uppercase tracking-wider mb-3">Legend</p>
            {[
              { color: '#27a065', label: 'Healthy (70–100)' },
              { color: '#e09d3f', label: 'Moderate (40–69)' },
              { color: '#e24b4a', label: 'Stressed (0–39)' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ background: item.color }}/>
                <span className="text-xs text-forest-500">{item.label}</span>
              </div>
            ))}
            <p className="text-xs text-forest-800 mt-3 leading-relaxed">
              Numbered circles = multiple scans. Color shows avg health. Click any marker or cluster to inspect.
            </p>
          </div>

          {/* No location hint */}
          {!hasLocation && (
            <div className="rounded-2xl border border-dashed border-forest-900 bg-[#0f1a13] p-4 text-center">
              <p className="text-xs text-forest-700 leading-relaxed">
                Scan reports will appear as map markers once you enable location in the Leaf Scanner.
              </p>
            </div>
          )}

          {/* Selected reports panel */}
          {selectedGroup && (
            <div className="rounded-2xl border border-forest-900 bg-[#0f1a13] p-4 fade-up">
              <div className="flex items-center justify-between mb-3">
                <p className="font-display text-xs font-semibold text-forest-500 uppercase tracking-wider">
                  {selectedGroup.length === 1 ? 'Scan report' : `${selectedGroup.length} scans at this spot`}
                </p>
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="text-xs text-forest-700 hover:text-forest-500 transition-colors"
                >✕</button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {selectedGroup.map((r, i) => (
                  <div key={i} className="pb-3 border-b border-forest-900/40 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-forest-200 leading-tight">{r.plant_name}</p>
                      <span className="font-display text-base font-bold flex-shrink-0" style={{ color: scoreColor(r.health_score) }}>
                        {r.health_score}
                      </span>
                    </div>
                    <p className="text-xs text-forest-600 mt-0.5">{new Date(r.date).toLocaleDateString()}</p>
                    <p className={`text-xs mt-0.5 ${stressClass[r.stress_level] || 'text-yellow-400'}`}>
                      {r.stress_level} stress
                    </p>
                    {r.locationName && (
                      <p className="text-xs text-forest-700 mt-0.5">{r.locationName}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total scans */}
          <div className="rounded-2xl border border-forest-900 bg-[#0f1a13] p-4">
            <p className="font-display text-xs font-semibold text-forest-500 uppercase tracking-wider mb-2">Total scans</p>
            <p className="font-display text-3xl font-bold text-forest-300">{reports.length}</p>
          </div>
        </div>
      </div>
    </div>
  )
}