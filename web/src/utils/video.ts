export function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

export interface InstagramRef {
  type: 'reel' | 'p' | 'tv'
  shortcode: string
}

export function extractInstagram(url: string): InstagramRef | null {
  const match = url.match(/instagram\.com\/(reel|p|tv)\/([a-zA-Z0-9_-]+)/)
  if (!match) return null
  return { type: match[1] as InstagramRef['type'], shortcode: match[2] }
}
