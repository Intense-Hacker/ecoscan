import { useState, useRef } from 'react'
import { saveReport } from '../utils/storage'
import { extractGPS, reverseGeocode } from '../utils/exifGps'
import { enrichReport, getPollutionTone } from '../utils/pollution'

const API_KEY = import.meta.env.VITE_FEATHERLESS_API_KEY

// ─── Location picker sub-component ───────────────────────────────────────────
function LocationPicker({ location, onChange }) {
  const [mode, setMode]         = useState('none')   // 'none' | 'gps' | 'current' | 'manual'
  const [manual, setManual]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [locError, setLocError] = useState(null)

  async function useCurrent() {
    if (!navigator.geolocation) { setLocError('Geolocation not supported'); return }
    setLoading(true); setLocError(null); setMode('current')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        const name = await reverseGeocode(latitude, longitude)
        onChange({ latitude, longitude, name })
        setLoading(false)
      },
      (err) => { setLocError('Could not get location: ' + err.message); setLoading(false) }
    )
  }

  function submitManual() {
    const name = manual.trim()
    if (!name) return
    onChange({ name })
    setMode('manual-done')
  }

  function clear() { onChange(null); setMode('none'); setManual('') }

  return (
    <div className="mt-4 p-3 rounded-xl bg-forest-900/20 border border-forest-900/40">
      <p className="text-xs text-forest-500 font-medium mb-2 flex items-center gap-1.5">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        Location (optional)
      </p>

      {/* If location is set, show it */}
      {location ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-forest-300">
            {location.name || `${location.latitude?.toFixed(4)}, ${location.longitude?.toFixed(4)}`}
          </span>
          <button onClick={clear} className="text-xs text-forest-700 hover:text-forest-500 transition-colors ml-2">clear</button>
        </div>
      ) : loading ? (
        <p className="text-xs text-forest-600 animate-pulse">Getting location...</p>
      ) : (
        <>
          <div className="flex gap-1.5 flex-wrap">
            {mode !== 'gps-offered' && (
              <button onClick={useCurrent}
                className="text-xs px-2.5 py-1 rounded-lg border border-forest-800 text-forest-500 hover:text-forest-300 hover:border-forest-600 transition-colors">
                Use my location
              </button>
            )}
            <button onClick={() => setMode(mode === 'manual-input' ? 'none' : 'manual-input')}
              className="text-xs px-2.5 py-1 rounded-lg border border-forest-800 text-forest-500 hover:text-forest-300 hover:border-forest-600 transition-colors">
              Enter manually
            </button>
            <button onClick={clear}
              className="text-xs px-2.5 py-1 rounded-lg border border-forest-900/60 text-forest-800 hover:text-forest-600 transition-colors">
              Skip
            </button>
          </div>

          {mode === 'manual-input' && (
            <div className="mt-2 flex gap-1.5">
              <input
                type="text"
                value={manual}
                onChange={e => setManual(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitManual()}
                placeholder="e.g. Indore, Madhya Pradesh"
                className="flex-1 text-xs bg-forest-900/40 border border-forest-800 rounded-lg px-2.5 py-1.5 text-forest-300 placeholder-forest-800 outline-none focus:border-forest-600"
              />
              <button onClick={submitManual}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-forest-500 text-white hover:bg-forest-400 transition-colors">
                Set
              </button>
            </div>
          )}
          {locError && <p className="text-xs text-red-500 mt-1">{locError}</p>}
        </>
      )}
    </div>
  )
}

// ─── Main Scanner component ───────────────────────────────────────────────────
export default function Scanner() {
  const [image, setImage]     = useState(null)
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [dragging, setDragging] = useState(false)
  const [location, setLocation] = useState(null)
  const inputRef = useRef()

  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      setImage({ url: e.target.result, base64: e.target.result.split(',')[1], mime: file.type, file })
      setResult(null); setError(null); setLocation(null)

      // Try to extract GPS from EXIF
      const gps = await extractGPS(file)
      if (gps) {
        const name = await reverseGeocode(gps.latitude, gps.longitude)
        setLocation({ ...gps, name, source: 'exif' })
      }
    }
    reader.readAsDataURL(file)
  }

  async function scanLeaf() {
    if (!image) return
    if (!API_KEY) { setError('Add VITE_FEATHERLESS_API_KEY to your .env file'); return }
    setLoading(true); setError(null); setResult(null)


    const prompt = `You are EcoScan, an expert in plant pathology and environmental pollution detection.
FIRST check: does this image contain a plant, leaf, tree, or any vegetation?
If the image does NOT contain a plant, return ONLY this JSON: {"is_plant":false}
If it DOES contain a plant, return ONLY valid JSON in this structure:
{"is_plant":true,"plant_name":"string","health_score":<0-100>,"stress_level":"Low|Moderate|High|Critical","pollution_indicators":["symptom"],"likely_causes":["cause"],"eco_health_note":"1-2 sentences","fix_it_tips":["tip1","tip2","tip3"],"air_pollution_likelihood":<0-100>,"air_pollution_severity":<0-100>,"non_pollution_likelihood":<0-100>,"confidence":<0-100>,"plant_sensitivity":"Low|Medium|High","suspected_pollutants":["PM2.5","NOx","SO2","O3","Dust"],"air_pollution_note":"1-2 sentences about whether the stress looks linked to airborne pollution"}`

    try {
      const res = await fetch('https://api.featherless.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: 'moonshotai/Kimi-K2.5',
          max_tokens: 2048,
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content: 'You are EcoScan, an expert in plant pathology and environmental pollution detection. You MUST respond with ONLY a single valid JSON object. No markdown, no explanation, no extra text — just raw JSON. If the image is not a plant, return {"is_plant":false}.'
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.base64}` } }
              ]
            }
          ]
        })
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || `Error ${res.status}`) }
      const data = await res.json()
      const raw  = data.choices?.[0]?.message?.content || ''
      const jsonMatch = raw.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in response. Raw: ' + raw.slice(0, 200))
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.is_plant === false) {
        throw new Error('🌿 No plant detected. Please upload a photo of a plant or leaf.')
      }
      const enriched = enrichReport(parsed)
      setResult(enriched)
      saveReport({
        ...enriched,
        imageUrl: image.url,
        date: new Date().toISOString(),
        lat: location?.latitude ?? null,
        lng: location?.longitude ?? null,
        locationName: location?.name ?? null,
      })
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8 fade-up">
        <h1 className="font-display text-3xl font-bold text-forest-100 tracking-tight">Leaf Scanner</h1>
        <p className="text-forest-600 mt-1 text-sm">Upload a plant photo to detect environmental stress caused by air or soil pollution</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="fade-up-2">
          {!image ? (
            <div
              className={`rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center p-12 text-center min-h-64 ${
                dragging ? 'border-forest-400 bg-forest-900/20' : 'border-forest-900 hover:border-forest-700 bg-[#0f1a13]'
              }`}
              onClick={() => inputRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
            >
              <div className="w-14 h-14 rounded-2xl bg-forest-900/60 flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#27a065" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p className="font-display font-semibold text-forest-300 mb-1">Drop your plant photo here</p>
              <p className="text-xs text-forest-700">or click to browse · JPG, PNG, WEBP</p>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden">
                <img src={image.url} alt="Uploaded leaf" className="w-full object-cover max-h-72"/>
                {loading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-8 h-8 border-2 border-forest-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"/>
                      <p className="text-xs text-forest-300 font-medium">Analyzing with AI Vision...</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={scanLeaf} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-forest-500 text-white text-sm font-medium hover:bg-forest-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {loading ? 'Scanning...' : 'Scan for stress'}
                </button>
                <button onClick={() => { setImage(null); setResult(null); setError(null); setLocation(null) }}
                  className="px-3 py-2.5 rounded-xl border border-forest-900 text-forest-600 text-sm hover:text-forest-400 transition-colors">
                  Change
                </button>
              </div>
            </div>
          )}

          {error && <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-900/60 text-red-400 text-sm">{error}</div>}

          {/* Location picker — shown once an image is loaded */}
          {image && (
            <>
              {location?.source === 'exif' && !location._confirmed && (
                <div className="mt-3 p-3 rounded-xl bg-forest-900/30 border border-forest-800/60">
                  <p className="text-xs text-forest-400 mb-2 flex items-center gap-1.5">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#27a065" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    GPS found in photo
                  </p>
                  <p className="text-xs text-forest-300 mb-2">{location.name}</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setLocation({ ...location, _confirmed: true })}
                      className="text-xs px-2.5 py-1 rounded-lg bg-forest-500 text-white hover:bg-forest-400 transition-colors">
                      Use this location
                    </button>
                    <button
                      onClick={() => setLocation(null)}
                      className="text-xs px-2.5 py-1 rounded-lg border border-forest-800 text-forest-600 hover:text-forest-400 transition-colors">
                      Choose different
                    </button>
                  </div>
                </div>
              )}
              {(!location || (location?.source === 'exif' && !location._confirmed)) && (
                <LocationPicker
                  location={location?._confirmed ? location : null}
                  onChange={setLocation}
                />
              )}
              {location && location._confirmed && (
                <div className="mt-3 p-3 rounded-xl bg-forest-900/20 border border-forest-900/40 flex items-center justify-between">
                  <p className="text-xs text-forest-400 flex items-center gap-1.5">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#27a065" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    {location.name || `${location.latitude?.toFixed(4)}, ${location.longitude?.toFixed(4)}`}
                  </p>
                  <button onClick={() => setLocation(null)} className="text-xs text-forest-700 hover:text-forest-500 transition-colors">clear</button>
                </div>
              )}
              {location && !location._confirmed && location.source !== 'exif' && (
                <div className="mt-3 p-3 rounded-xl bg-forest-900/20 border border-forest-900/40 flex items-center justify-between">
                  <p className="text-xs text-forest-400 flex items-center gap-1.5">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#27a065" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    {location.name || `${location.latitude?.toFixed(4)}, ${location.longitude?.toFixed(4)}`}
                  </p>
                  <button onClick={() => setLocation(null)} className="text-xs text-forest-700 hover:text-forest-500 transition-colors">clear</button>
                </div>
              )}
            </>
          )}

          <div className="mt-4 p-3 rounded-xl bg-forest-900/20 border border-forest-900/40">
            <p className="text-xs text-forest-500 font-medium mb-1">Powered by Featherless.ai (Gemma Vision)</p>
            <p className="text-xs text-forest-800 leading-relaxed">
              Get key at <a href="https://featherless.ai" target="_blank" rel="noreferrer" className="text-forest-500 underline">featherless.ai</a> → paste in <code className="bg-forest-900/60 px-1 rounded">.env</code> as VITE_FEATHERLESS_API_KEY
            </p>
          </div>
        </div>

        <div className="fade-up-3">
          {!result && !loading && (
            <div className="rounded-2xl border border-forest-900/60 bg-[#0f1a13]/60 p-8 flex items-center justify-center text-center min-h-64">
              <p className="text-forest-700 text-sm">Results will appear here after scanning</p>
            </div>
          )}
          {loading && (
            <div className="rounded-2xl border border-forest-900 bg-[#0f1a13] p-6 space-y-3">
              {[60,90,75,85,50].map((w,i) => <div key={i} className="h-3 rounded-full bg-forest-900/60 animate-pulse" style={{width:`${w}%`}}/>)}
            </div>
          )}
          {result && <ResultCard result={result} />}
        </div>
      </div>
    </div>
  )
}

function ResultCard({ result }) {
  const score = Math.round(result.health_score)
  const scoreColor = score >= 70 ? '#27a065' : score >= 40 ? '#e09d3f' : '#e24b4a'
  const pollutionTone = getPollutionTone(result.pollution_band ?? result.bioindicator_score ?? 0)
  const pollutionLikelihood = Math.round((result.air_pollution_likelihood ?? 0) * 100)
  const pollutionConfidence = Math.round((result.confidence ?? 0) * 100)
  const stressCfg = {
    Low:      'bg-green-900/40 text-green-400 border-green-900',
    Moderate: 'bg-yellow-900/40 text-yellow-400 border-yellow-900',
    High:     'bg-red-900/40 text-red-400 border-red-900',
    Critical: 'bg-red-900/60 text-red-300 border-red-800'
  }
  return (
    <div className="rounded-2xl border border-forest-900 bg-[#0f1a13] overflow-hidden fade-up">
      <div className="px-5 py-4 border-b border-forest-900/60 flex items-center justify-between">
        <div>
          <p className="text-xs text-forest-700 uppercase tracking-wider mb-0.5">Plant identified</p>
          <p className="font-display font-semibold text-forest-200 text-sm">{result.plant_name}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-bold" style={{color:scoreColor}}>{score}</p>
          <p className="text-xs text-forest-700">/ 100</p>
        </div>
      </div>
      <div className="px-5 py-3 border-b border-forest-900/60">
        <div className="flex justify-between text-xs text-forest-700 mb-1.5">
          <span>Health level</span>
          <span className={`px-2 py-0.5 rounded-full border text-xs ${stressCfg[result.stress_level]||stressCfg.Moderate}`}>{result.stress_level} stress</span>
        </div>
        <div className="h-1.5 bg-forest-900 rounded-full overflow-hidden">
          <div className="health-bar-fill h-full rounded-full" style={{width:`${score}%`,background:scoreColor}}/>
        </div>
      </div>
      <div className="px-5 py-4 border-b border-forest-900/60">
        <div className="rounded-xl border border-forest-900/60 bg-forest-900/20 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-forest-500 uppercase tracking-wider mb-1">Air pollution estimate</p>
              <p className="font-display text-lg font-semibold" style={{ color: pollutionTone.color }}>
                {result.pollution_band || 'Moderate'} risk
              </p>
              <p className="text-xs text-forest-600 mt-1 max-w-sm leading-relaxed">
                {result.air_pollution_note || 'This estimate is based on leaf symptoms that can act as bioindicators of airborne stress.'}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-display text-3xl font-bold" style={{ color: pollutionTone.color }}>
                {result.bioindicator_score ?? 0}
              </p>
              <p className="text-xs text-forest-700">bioindicator</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
            {[
              { label: 'Likelihood', value: `${pollutionLikelihood}%` },
              { label: 'Severity', value: `${result.air_pollution_severity ?? 0}` },
              { label: 'Confidence', value: `${pollutionConfidence}%` },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-forest-900/60 bg-[#0f1a13] px-3 py-2">
                <p className="text-[11px] uppercase tracking-wider text-forest-700">{item.label}</p>
                <p className="font-display text-lg font-semibold text-forest-300">{item.value}</p>
              </div>
            ))}
          </div>
          {result.suspected_pollutants?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-forest-600 uppercase tracking-wider mb-2">Suspected pollutants</p>
              <div className="flex flex-wrap gap-1.5">
                {result.suspected_pollutants.map((pollutant, index) => (
                  <span
                    key={`${pollutant}-${index}`}
                    className={`text-xs px-2 py-0.5 rounded-full border ${pollutionTone.badgeClass}`}
                  >
                    {pollutant}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="px-5 py-4 space-y-4 max-h-80 overflow-y-auto">
        {result.eco_health_note && (
          <div className="p-3 rounded-lg bg-forest-900/30 border border-forest-900/60">
            <p className="text-xs text-forest-500 uppercase tracking-wider mb-1">Eco health note</p>
            <p className="text-sm text-forest-300 leading-relaxed">{result.eco_health_note}</p>
          </div>
        )}
        {result.pollution_indicators?.length > 0 && <Section title="Symptoms detected" items={result.pollution_indicators} dotColor="#e24b4a"/>}
        {result.likely_causes?.length > 0 && <Section title="Likely causes" items={result.likely_causes} dotColor="#e09d3f"/>}
        {result.fix_it_tips?.length > 0 && <Section title="Fix-it tips" items={result.fix_it_tips} dotColor="#27a065"/>}
      </div>
    </div>
  )
}

function Section({ title, items, dotColor }) {
  return (
    <div>
      <p className="text-xs text-forest-600 uppercase tracking-wider mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item,i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-forest-400">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:dotColor}}/>{item}
          </li>
        ))}
      </ul>
    </div>
  )
}
