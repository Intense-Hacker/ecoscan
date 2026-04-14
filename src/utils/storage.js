const KEY = 'ecoscan_reports'

export function getReports() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') }
  catch { return [] }
}

export function saveReport(report) {
  const reports = getReports()
  reports.push({ ...report, id: Date.now() + Math.random() })
  localStorage.setItem(KEY, JSON.stringify(reports))
}

export function deleteReport(id) {
  const reports = getReports().filter(r => r.id !== id)
  localStorage.setItem(KEY, JSON.stringify(reports))
}

export function clearReports() {
  localStorage.removeItem(KEY)
}