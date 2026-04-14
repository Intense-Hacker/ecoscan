/**
 * Lightweight JPEG EXIF GPS extractor — no external dependencies.
 * Reads only the first 64 KB of the file (EXIF is always near the start).
 */
export async function extractGPS(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try { resolve(parseJpegExifGPS(new DataView(e.target.result))) }
      catch { resolve(null) }
    }
    reader.onerror = () => resolve(null)
    reader.readAsArrayBuffer(file.slice(0, 65536))
  })
}

function parseJpegExifGPS(view) {
  if (view.getUint16(0) !== 0xFFD8) return null // not a JPEG

  let pos = 2
  while (pos < view.byteLength - 4) {
    const marker = view.getUint16(pos)
    const segLen  = view.getUint16(pos + 2)

    if (marker === 0xFFE1 && segLen > 6) {
      const h = [pos+4, pos+5, pos+6, pos+7].map(i => String.fromCharCode(view.getUint8(i))).join('')
      if (h === 'Exif') {
        const tiff = pos + 10
        const le   = view.getUint16(tiff) === 0x4949
        const r16  = o => view.getUint16(tiff + o, le)
        const r32  = o => view.getUint32(tiff + o, le)

        const ifd0  = r32(4)
        const nTags = r16(ifd0)
        for (let i = 0; i < nTags; i++) {
          const e = ifd0 + 2 + i * 12
          if (r16(e) === 0x8825) return readGPSIFD(view, tiff, r32(e + 8), le)
        }
      }
    }
    if ((marker & 0xFF00) !== 0xFF00) break
    pos += 2 + segLen
  }
  return null
}

function readGPSIFD(view, tiff, gpsOff, le) {
  const r16  = o => view.getUint16(tiff + o, le)
  const r32  = o => view.getUint32(tiff + o, le)
  const rat  = o => { const d = r32(o + 4); return d ? r32(o) / d : 0 }

  const n = r16(gpsOff)
  const g = {}

  for (let i = 0; i < n; i++) {
    const e   = gpsOff + 2 + i * 12
    const tag = r16(e)
    const vo  = e + 8 // value/offset field (TIFF-relative)

    if (tag === 0x0001) g.latRef = String.fromCharCode(view.getUint8(tiff + vo))
    if (tag === 0x0003) g.lonRef = String.fromCharCode(view.getUint8(tiff + vo))

    if (tag === 0x0002 || tag === 0x0004) {
      const off = r32(vo)   // TIFF-relative offset to the 3 rationals
      const deg = rat(tiff + off)
      const min = rat(tiff + off + 8)
      const sec = rat(tiff + off + 16)
      const dec = deg + min / 60 + sec / 3600
      if (tag === 0x0002) g.lat = dec
      if (tag === 0x0004) g.lon = dec
    }
  }

  if (g.lat == null || g.lon == null) return null
  return {
    latitude:  g.latRef === 'S' ? -g.lat : g.lat,
    longitude: g.lonRef === 'W' ? -g.lon : g.lon,
  }
}

/** Reverse-geocode using free Nominatim (OpenStreetMap). Returns a place name string. */
export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    const a = data.address || {}
    return (a.city || a.town || a.village || a.county || '') +
           (a.state ? `, ${a.state}` : '') +
           (a.country ? `, ${a.country}` : '')
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}
