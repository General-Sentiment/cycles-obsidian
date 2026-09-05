import { App, TFile, normalizePath } from "obsidian";
import { formatVisitedProperty, parseVisitedDate } from "./cycle";
import { parseLegacyVisitRecord, type LegacyVisitRecord } from "./legacy-record";

export async function migrateLegacyVisits(
  app: App,
  storageFolder = "cycle-data"
): Promise<number> {
  const notesFolder = normalizePath(`${storageFolder}/notes`);
  if (!(await app.vault.adapter.exists(notesFolder))) return 0;

  const latestByPath = new Map<string, LegacyVisitRecord>();
  const listing = await app.vault.adapter.list(notesFolder);
  for (const path of listing.files.filter((file) => file.endsWith(".json"))) {
    try {
      const record = parseLegacyVisitRecord(
        JSON.parse(await app.vault.adapter.read(path)) as unknown
      );
      if (!record) continue;
      record.notePath = normalizePath(record.notePath);
      const current = latestByPath.get(record.notePath);
      if (!current || record.lastVisitedAt > current.lastVisitedAt) {
        latestByPath.set(record.notePath, record);
      }
    } catch {
      // One damaged legacy shard should not prevent other notes from migrating.
    }
  }

  let migrated = 0;
  for (const record of latestByPath.values()) {
    const file = app.vault.getAbstractFileByPath(record.notePath);
    if (!(file instanceof TFile) || file.extension !== "md") continue;
    if (parseVisitedDate(app.metadataCache.getFileCache(file)?.frontmatter?.visited)) {
      continue;
    }

    await app.fileManager.processFrontMatter(file, (frontmatter) => {
      if (!parseVisitedDate(frontmatter.visited)) {
        frontmatter.visited = formatVisitedProperty(record.lastVisitedAt);
      }
    });
    migrated += 1;
  }
  return migrated;
}
