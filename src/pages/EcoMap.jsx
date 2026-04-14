import { useEffect, useRef, useState } from 'react'
import { getReports } from '../utils/storage'

export default function EcoMap() {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const [reports] = useState(getReports)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (mapInstance.current) return

    import('leaflet').then(L => {
      const map = L.map(mapRef.current, {
        center: [22.3039, 70.8022],
        zoom: 13,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map)

      reports.forEach(r => {
        if (!r.lat || !r.lng) return
        const color = r.health_score >= 70 ? '#27a065' : r.health_score >= 40 ? '#e09d3f' : '#e24b4a'
        const marker = L.circleMarker([r.lat, r.lng], {
          radius: 10, fillColor: color, color: color,
          weight: 2, opacity: 0.9, fillOpacity: 0.6
        }).addTo(map)
        marker.on('click', () => setSelected(r))
      })

      mapInstance.current = map
    })

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [])

  const hasLocation = reports.some(r => r.lat && r.lng)

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6 fade-up">
        <h1 className="font-display text-3xl font-bold text-forest-100 tracking-tight">Eco Map</h1>
        <p className="text-forest-600 mt-1 text-sm">Crowdsourced map of plant health across your neighborhood</p>
      </div>

      <div className="fade-up-2 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-forest-900 h-96 lg:h-[500px]" ref={mapRef}/>

        {/* Legend + selected */}
        <div className="space-y-4">
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
          </div>

          {!hasLocation && (
            <div className="rounded-2xl border border-dashed border-forest-900 bg-[#0f1a13] p-4 text-center">
              <p className="text-xs text-forest-700 leading-relaxed">
                Scan reports will show as map markers once location data is available.
                <br/><br/>
                For now, scan plants and check the Reports tab.
              </p>
            </div>
          )}

          {selected && (
            <div className="rounded-2xl border border-forest-900 bg-[#0f1a13] p-4 fade-up">
              <p className="font-display text-xs font-semibold text-forest-500 uppercase tracking-wider mb-2">Selected marker</p>
              <p className="text-sm font-medium text-forest-200">{selected.plant_name}</p>
              <p className="text-xs text-forest-600 mt-1">{new Date(selected.date).toLocaleDateString()}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-forest-600">Health score</span>
                <span className="font-display text-lg font-bold text-forest-300">{selected.health_score}</span>
              </div>
              <p className="text-xs text-forest-600 mt-2">{selected.stress_level} stress</p>
            </div>
          )}

          <div className="rounded-2xl border border-forest-900 bg-[#0f1a13] p-4">
            <p className="font-display text-xs font-semibold text-forest-500 uppercase tracking-wider mb-2">Total scans</p>
            <p className="font-display text-3xl font-bold text-forest-300">{reports.length}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
