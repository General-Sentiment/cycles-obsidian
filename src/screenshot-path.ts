function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0").slice(0, 7);
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || "cycle-preview";
}

function previewStem(notePath: string, basename: string, mediaFolder: string): string {
  return `${normalizeMediaFolder(mediaFolder)}/${slugify(basename)}-${shortHash(notePath)}`;
}

export interface PreviewPaths {
  legacy: string;
  screenshot: string;
  social: string;
}

export function getPreviewPaths(
  notePath: string,
  basename: string,
  mediaFolder = DEFAULT_MEDIA_FOLDER
): PreviewPaths {
  const stem = previewStem(notePath, basename, mediaFolder);
  return {
    legacy: `${stem}.jpg`,
    screenshot: `${stem}-screenshot.jpg`,
    social: `${stem}-social.jpg`
  };
}

export function unwrapImageReference(value: string): string {
  const trimmed = value.trim();
  const match = /^!?\[\[([^|\]#]+)(?:#[^|\]]+)?(?:\|[^\]]+)?\]\]$/u.exec(trimmed);
  return match?.[1]?.trim() ?? trimmed;
}
export const DEFAULT_MEDIA_FOLDER = "media/cycles";

export function normalizeMediaFolder(value: string): string {
  const trimmed = value.trim().replace(/\\/g, "/");
  if (/^(?:\/|[a-z]:)/iu.test(trimmed)) {
    throw new Error("Media folder must be relative to the vault root.");
  }

  const segments = trimmed.split("/").filter((segment) => segment && segment !== ".");
  if (segments.some((segment) => segment === "..")) {
    throw new Error("Media folder must stay inside the vault.");
  }
  const normalized = segments.join("/") || DEFAULT_MEDIA_FOLDER;
  if (normalized === ".obsidian" || normalized.startsWith(".obsidian/")) {
    throw new Error("Choose a normal vault folder, not .obsidian.");
  }
  return normalized;
}
