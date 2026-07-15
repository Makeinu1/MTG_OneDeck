function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag);
  return match?.[2] ?? null;
}

/** Extract the built entry asset without depending on DOMParser or app state. */
export function moduleAssetUrlFromHtml(html: string, pageUrl: string): string | null {
  const tags = html.match(/<script\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (attribute(tag, 'type') !== 'module') continue;
    const source = attribute(tag, 'src');
    if (!source) continue;
    try {
      return new URL(source, pageUrl).href;
    } catch {
      return null;
    }
  }
  return null;
}

export function isNewAssetAvailable(
  currentAssetUrl: string | null,
  latestAssetUrl: string | null,
): boolean {
  return currentAssetUrl !== null
    && latestAssetUrl !== null
    && currentAssetUrl !== latestAssetUrl;
}
