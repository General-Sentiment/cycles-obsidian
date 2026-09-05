import { requestUrl } from "obsidian";
import { formatWebsiteDomain, parseHttpUrl } from "./url";

export interface LinkMetadata {
  url: string;
  title: string;
  description: string;
  imageUrl: string | null;
  warning?: string;
}

export function readLinkMetadata(document: Document, url: string): LinkMetadata {
  const meta = (selectors: string[]) => {
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.getAttribute("content")?.trim();
      if (value) return value;
    }
    return "";
  };
  const title = meta(['meta[property="og:title"]', 'meta[name="twitter:title"]'])
    || document.querySelector("title")?.textContent?.trim()
    || formatWebsiteDomain(url) || "New cycle note";
  const description = meta(['meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]']);
  const image = meta(['meta[property="og:image:secure_url"]', 'meta[property="og:image"]', 'meta[name="twitter:image"]', 'meta[property="twitter:image"]'])
    || document.querySelector('link[rel="image_src"]')?.getAttribute("href");
  let imageUrl: string | null = null;
  if (image) {
    try { imageUrl = parseHttpUrl(new URL(image, url).href); } catch { /* Ignore malformed metadata. */ }
  }
  return { url, title: title.replace(/\s+/g, " ").slice(0, 200), description: description.slice(0, 2000), imageUrl };
}

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      requestUrl({ url, headers: { Accept: "text/html,application/xhtml+xml" }, throw: false }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Timed out")), 12000); })
    ]);
    if (response.status < 200 || response.status >= 400) throw new Error(`HTTP ${response.status}`);
    return readLinkMetadata(new DOMParser().parseFromString(response.text, "text/html"), url);
  } catch {
    return { url, title: formatWebsiteDomain(url) ?? "New cycle note", description: "", imageUrl: null,
      warning: "This site did not provide page details. You can enter a title and continue." };
  } finally {
    clearTimeout(timer);
  }
}
