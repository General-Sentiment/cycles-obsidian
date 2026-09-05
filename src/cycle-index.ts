import { TFile, type App } from "obsidian";
import { getCategoryIcon } from "./category-icon";
import {
  calculateNextDue,
  formatVisitedProperty,
  isDue,
  parseCycle,
  parseVisitedDate
} from "./cycle";
import type { CycleNote } from "./types";
import { parseHttpUrl } from "./url";

export class CycleIndex {
  constructor(private readonly app: App) {}

  getCycleNote(file: TFile, now = new Date()): CycleNote | null {
    const cache = this.app.metadataCache.getFileCache(file);
    const result = parseCycle(cache?.frontmatter?.cycle);
    if (result.kind !== "cycle") return null;

    const visited = parseVisitedDate(cache?.frontmatter?.visited);
    const lastVisitedAt = visited ? formatVisitedProperty(visited) : null;
    const dueAt = calculateNextDue(lastVisitedAt, result.cycle);
    const imageValue = cache?.frontmatter?.image;
    const image =
      typeof imageValue === "string" && imageValue.trim()
        ? imageValue.trim()
        : null;
    return {
      file,
      cycle: result.cycle,
      url: parseHttpUrl(cache?.frontmatter?.url),
      image,
      imageSrc: this.resolveImageSource(file, image),
      placeholderIcon: getCategoryIcon(
        cache?.frontmatter?.categories ?? cache?.frontmatter?.category
      ),
      lastVisitedAt,
      dueAt,
      due: isDue(dueAt, now)
    };
  }

  getDueNotes(now = new Date()): CycleNote[] {
    return this.getAllCycleNotes(now)
      .filter((note) => note.due)
      .sort((a, b) => {
        if (!a.dueAt && b.dueAt) return -1;
        if (a.dueAt && !b.dueAt) return 1;
        const dueDifference = (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0);
        return dueDifference || a.file.basename.localeCompare(b.file.basename);
      });
  }

  getAllCycleNotes(now = new Date()): CycleNote[] {
    return this.app.vault
      .getMarkdownFiles()
      .map((file) => this.getCycleNote(file, now))
      .filter((note): note is CycleNote => note !== null);
  }

  private resolveImageSource(file: TFile, value: string | null): string | null {
    if (!value) return null;
    const external = parseHttpUrl(value);
    if (external) return external;

    const match = /^!?\[\[([^|\]#]+)(?:#[^|\]]+)?(?:\|[^\]]+)?\]\]$/u.exec(value);
    const linkPath = match?.[1]?.trim() ?? value;
    const imageFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
    return imageFile instanceof TFile
      ? this.app.vault.getResourcePath(imageFile)
      : null;
  }
}
