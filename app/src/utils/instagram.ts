const INSTAGRAM_PATTERN = /instagram\.com\/(reel|p|tv)\/([a-zA-Z0-9_-]+)/;

export interface InstagramVideoRef {
  type: 'reel' | 'p' | 'tv';
  shortcode: string;
}

export function getInstagramVideoRef(url: string): InstagramVideoRef | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const match = trimmed.match(INSTAGRAM_PATTERN);
  if (!match) return null;
  return { type: match[1] as InstagramVideoRef['type'], shortcode: match[2] };
}

export function getInstagramWatchUrl(ref: InstagramVideoRef): string {
  return `https://www.instagram.com/${ref.type}/${ref.shortcode}/`;
}

// Instagram's own embed page (used by anyone who copy-pastes a plain <iframe src="…/embed">
// into a blog) is designed for arbitrary third-party embedding, unlike YouTube's origin-locked
// iframe API — but we still wrap it in an HTML doc with baseUrl set to instagram.com, matching
// the same safe pattern that fixed the YouTube embed, instead of assuming it's unnecessary here.
export function getInstagramEmbedHtml(ref: InstagramVideoRef): string {
  const embedUrl = `https://www.instagram.com/${ref.type}/${ref.shortcode}/embed/`;
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <style>
          html, body { margin: 0; padding: 0; background: #000; height: 100%; }
          iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }
        </style>
      </head>
      <body>
        <iframe src="${embedUrl}" allowfullscreen></iframe>
      </body>
    </html>
  `;
}
