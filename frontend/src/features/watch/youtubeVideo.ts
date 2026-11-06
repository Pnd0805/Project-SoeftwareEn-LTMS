export function safeVideoLink(value: string | null | undefined): URL | null {
  if (!value?.trim()) return null
  try {
    const source = value.trim()
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(source) ? source : `https://${source}`)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url : null
  } catch { return null }
}

/** สร้าง embed URL ใหม่จาก host/video ID เท่านั้น ไม่ส่ง URL ที่ผู้ใช้กรอกเข้า iframe ตรง ๆ */
export function youtubeVideo(value: string | null | undefined) {
  const url = safeVideoLink(value)
  if (!url) return null
  const host = url.hostname.toLowerCase()
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else if (/^\/(embed|live|shorts)\//.test(url.pathname)) id = url.pathname.split('/')[2] ?? null
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null
  const embed = new URL(`https://www.youtube.com/embed/${id}`)
  embed.searchParams.set('playsinline', '1')
  const original = new URL(`https://www.youtube.com/watch?v=${id}`)
  const marker = url.searchParams.get('start') ?? url.searchParams.get('t') ?? new URLSearchParams(url.hash.slice(1)).get('t')
  const parts = marker ? /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(marker) : null
  const seconds = marker && /^\d+$/.test(marker) ? Number(marker)
    : parts ? Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0) : 0
  if (seconds > 0 && Number.isSafeInteger(seconds)) {
    embed.searchParams.set('start', String(seconds))
    original.searchParams.set('t', `${seconds}s`)
  }
  return { embedUrl: embed.href, originalUrl: original.href }
}
