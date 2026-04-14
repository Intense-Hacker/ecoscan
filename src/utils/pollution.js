const POLLUTION_KEYWORDS = [
  'air pollution',
  'pollution',
  'pm2.5',
  'pm10',
  'particulate',
  'dust',
  'soot',
  'smoke',
  'emission',
  'exhaust',
  'traffic',
  'industrial',
  'ozone',
  'sulfur',
  'sulphur',
  'nitrogen',
  'nox',
  'so2',
  'o3',
  'airborne',
  'deposition',
]

const STRESS_SEVERITY = { Low: 24, Moderate: 46, High: 70, Critical: 88 }
const STRESS_LIKELIHOOD = { Low: 0.18, Moderate: 0.36, High: 0.6, Critical: 0.76 }
const SENSITIVITY_WEIGHT = { Low: 0.9, Medium: 1, High: 1.12 }

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalizeProbability(value, fallback) {
  const numeric = toNumber(value)
  if (numeric == null) return clamp(fallback, 0, 1)
  if (numeric > 1) return clamp(numeric / 100, 0, 1)
  return clamp(numeric, 0, 1)
}

function normalizeSeverity(value, fallback) {
  const numeric = toNumber(value)
  if (numeric == null) return clamp(Math.round(fallback), 0, 100)
  if (numeric <= 1) return clamp(Math.round(numeric * 100), 0, 100)
  return clamp(Math.round(numeric), 0, 100)
}

function asStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function normalizeSensitivity(value) {
  const input = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (input === 'high') return 'High'
  if (input === 'low') return 'Low'
  return 'Medium'
}

function getPollutionEvidenceCount(report) {
  const haystack = [
    ...asStringArray(report.pollution_indicators),
    ...asStringArray(report.likely_causes),
    ...asStringArray(report.suspected_pollutants),
    report.eco_health_note,
    report.air_pollution_note,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return POLLUTION_KEYWORDS.reduce((count, keyword) => {
    return haystack.includes(keyword) ? count + 1 : count
  }, 0)
}

function getSeverityFallback(report) {
  const score = toNumber(report.health_score)
  const stressSeverity = STRESS_SEVERITY[report.stress_level] ?? 40
  if (score == null) return stressSeverity
  return clamp(Math.round((100 - score) * 0.82 + stressSeverity * 0.18), 0, 100)
}

function getProbabilityFallback(report, evidenceCount) {
  const base = STRESS_LIKELIHOOD[report.stress_level] ?? 0.28
  return clamp(base + evidenceCount * 0.09, 0.12, 0.94)
}

function getFreshnessWeight(dateValue, windowDays) {
  if (!dateValue) return 0.7
  const time = new Date(dateValue).getTime()
  if (Number.isNaN(time)) return 0.7
  const ageDays = (Date.now() - time) / 86400000
  if (ageDays <= 0) return 1
  if (ageDays >= windowDays) return 0.35
  return clamp(1 - (ageDays / windowDays) * 0.65, 0.35, 1)
}

function buildAreaNote(summary) {
  if (!summary.sampleCount) {
    return 'Add a few plant scans to start estimating airborne pollution stress in the area.'
  }
  if (summary.band === 'Severe') {
    return 'Multiple recent plant scans show strong symptoms that are consistent with polluted-air exposure.'
  }
  if (summary.band === 'High') {
    return 'Recent scans show repeated airborne-stress patterns. More geo-tagged samples will strengthen this estimate.'
  }
  if (summary.band === 'Moderate') {
    return 'Some scans show airborne stress, but the area signal is still mixed.'
  }
  return 'Current scans do not show a strong polluted-air pattern.'
}

export function getPollutionBand(score) {
  if (score >= 75) return 'Severe'
  if (score >= 55) return 'High'
  if (score >= 30) return 'Moderate'
  return 'Low'
}

export function getPollutionTone(scoreOrBand) {
  const band = typeof scoreOrBand === 'number' ? getPollutionBand(scoreOrBand) : scoreOrBand
  if (band === 'Severe') {
    return {
      color: '#e24b4a',
      badgeClass: 'bg-red-900/60 text-red-300 border-red-800',
      mutedClass: 'text-red-400',
    }
  }
  if (band === 'High') {
    return {
      color: '#f97316',
      badgeClass: 'bg-orange-900/40 text-orange-300 border-orange-800',
      mutedClass: 'text-orange-300',
    }
  }
  if (band === 'Moderate') {
    return {
      color: '#e09d3f',
      badgeClass: 'bg-yellow-900/40 text-yellow-400 border-yellow-900',
      mutedClass: 'text-yellow-400',
    }
  }
  return {
    color: '#27a065',
    badgeClass: 'bg-green-900/40 text-green-400 border-green-900',
    mutedClass: 'text-green-400',
  }
}

export function enrichReport(report = {}) {
  const evidenceCount = getPollutionEvidenceCount(report)
  const airPollutionSeverity = normalizeSeverity(
    report.air_pollution_severity,
    getSeverityFallback(report)
  )
  const airPollutionLikelihood = normalizeProbability(
    report.air_pollution_likelihood,
    getProbabilityFallback(report, evidenceCount)
  )
  const nonPollutionLikelihood = normalizeProbability(
    report.non_pollution_likelihood,
    evidenceCount > 0 ? 0.24 : 0.52
  )
  const confidence = normalizeProbability(
    report.confidence,
    evidenceCount > 0 ? 0.72 : 0.48
  )
  const plantSensitivity = normalizeSensitivity(report.plant_sensitivity)
  const suspectedPollutants = asStringArray(report.suspected_pollutants)
  const severityWeight = SENSITIVITY_WEIGHT[plantSensitivity] ?? 1

  const bioindicatorScore = clamp(
    Math.round(
      airPollutionSeverity *
        airPollutionLikelihood *
        confidence *
        severityWeight *
        (1 - nonPollutionLikelihood * 0.6)
    ),
    0,
    100
  )

  return {
    ...report,
    air_pollution_severity: airPollutionSeverity,
    air_pollution_likelihood: airPollutionLikelihood,
    non_pollution_likelihood: nonPollutionLikelihood,
    confidence,
    plant_sensitivity: plantSensitivity,
    suspected_pollutants: suspectedPollutants,
    bioindicator_score: bioindicatorScore,
    pollution_band: getPollutionBand(bioindicatorScore),
  }
}

export function getAreaPollutionSummary(reports = [], options = {}) {
  const windowDays = options.windowDays ?? 21
  const requireLocation = options.requireLocation ?? false
  const recentReports = reports
    .map(enrichReport)
    .filter((report) => !requireLocation || (report.lat != null && report.lng != null))
    .filter((report) => {
      if (!report.date) return true
      const age = Date.now() - new Date(report.date).getTime()
      if (Number.isNaN(age)) return true
      return age <= windowDays * 86400000
    })

  if (!recentReports.length) {
    const empty = {
      score: 0,
      band: 'Low',
      sampleCount: 0,
      geoSampleCount: 0,
      highSignalCount: 0,
      confidence: 0,
    }
    return { ...empty, note: buildAreaNote(empty) }
  }

  let weightedSum = 0
  let weightTotal = 0
  let confidenceWeighted = 0
  let highSignalCount = 0

  recentReports.forEach((report) => {
    const freshnessWeight = getFreshnessWeight(report.date, windowDays)
    const geoWeight = report.lat != null && report.lng != null ? 1.08 : 0.92
    const signalWeight = 0.75 + report.air_pollution_likelihood * 0.5
    const weight = freshnessWeight * geoWeight * signalWeight * Math.max(report.confidence, 0.2)

    weightedSum += report.bioindicator_score * weight
    weightTotal += weight
    confidenceWeighted += report.confidence * weight

    if (report.bioindicator_score >= 55) highSignalCount += 1
  })

  const score = weightTotal ? Math.round(weightedSum / weightTotal) : 0
  const avgConfidence = weightTotal ? confidenceWeighted / weightTotal : 0
  const sampleBoost = Math.min(recentReports.length, 12) / 12
  const confidence = clamp(avgConfidence * 0.7 + sampleBoost * 0.3, 0, 1)
  const geoSampleCount = recentReports.filter((report) => report.lat != null && report.lng != null).length

  const summary = {
    score,
    band: getPollutionBand(score),
    sampleCount: recentReports.length,
    geoSampleCount,
    highSignalCount,
    confidence,
  }

  return {
    ...summary,
    note: buildAreaNote(summary),
  }
}
