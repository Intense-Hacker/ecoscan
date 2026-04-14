const KEY = 'ecoscan_reports'

export function getReports() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function saveReport(report) {
  const reports = getReports()
  reports.push(report)
  localStorage.setItem(KEY, JSON.stringify(reports))
}

export function clearReports() {
  localStorage.removeItem(KEY)
}
