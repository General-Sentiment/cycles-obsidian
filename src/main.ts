import { Notice, Plugin, TFile, normalizePath, type WorkspaceLeaf } from "obsidian";
import { CycleIndex } from "./cycle-index";
import { extendCycleValue, formatVisitedProperty, parseCycle, type ParsedCycle } from "./cycle";
import { CYCLES_VIEW_TYPE, CyclesView } from "./cycles-view";
import { migrateLegacyVisits } from "./legacy-migration";
import { CyclesSettingTab } from "./settings";
import { ScreenshotService } from "./screenshot-service";
import { DEFAULT_MEDIA_FOLDER, normalizeMediaFolder } from "./screenshot-path";
import type { CyclesSettings } from "./types";

const DEFAULT_SETTINGS: CyclesSettings = {
  mediaFolder: DEFAULT_MEDIA_FOLDER,
  showCycleDuration: true,
  showWebsiteDomain: true,
  showPlatformIcons: true,
  captureMissingImages: true,
  legacyVisitMigrationCompleted: false
};

interface StoredSettings extends Partial<CyclesSettings> {
  storageFolder?: unknown;
}

function legacyStorageFolder(value: unknown): string {
  if (typeof value !== "string") return "cycle-data";
  const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (
    !trimmed ||
    trimmed.split("/").some((segment) => segment === "..") ||
    trimmed === ".obsidian" ||
    trimmed.startsWith(".obsidian/")
  ) {
    return "cycle-data";
  }
  return normalizePath(trimmed);
}

export default class CyclesPlugin extends Plugin {
  settings: CyclesSettings = DEFAULT_SETTINGS;
  cycleIndex!: CycleIndex;
  screenshotService!: ScreenshotService;
  private readonly suppressedMetadataRefreshes = new Set<string>();
  private legacyFolder = "cycle-data";

  async onload(): Promise<void> {
    await this.loadSettings();
    if (!this.settings.legacyVisitMigrationCompleted) {
      const migrated = await migrateLegacyVisits(this.app, this.legacyFolder);
      this.settings.legacyVisitMigrationCompleted = true;
      await this.saveSettings();
      if (migrated > 0) {
        new Notice(
          `Cycles migrated ${migrated} ${migrated === 1 ? "visit" : "visits"} to note properties.`
        );
      }
    }
    this.cycleIndex = new CycleIndex(this.app);
    this.screenshotService = new ScreenshotService(
      this.app,
      () => this.settings.mediaFolder
    );

    this.registerView(
      CYCLES_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new CyclesView(leaf, this)
    );

    this.addRibbonIcon("refresh-cw", "Open Cycles", () => void this.activateView());

    this.addCommand({
      id: "open-due-notes",
      name: "Open due notes",
      callback: () => void this.activateView()
    });

    this.addCommand({
      id: "mark-active-note-reviewed",
      name: "Mark active note visited",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const isCycling = file ? this.cycleIndex.getCycleNote(file) !== null : false;
        if (!file || !isCycling) return false;
        if (!checking) {
          void this.recordVisit(file.path).then(() => this.refreshViews());
        }
        return true;
      }
    });

    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (this.suppressedMetadataRefreshes.delete(file.path)) return;
        void this.refreshViews();
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        this.suppressedMetadataRefreshes.delete(file.path);
        void this.refreshViews();
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", () => {
        void this.refreshViews();
      })
    );

    this.registerInterval(
      window.setInterval(() => void this.refreshViews(), 15 * 60 * 1000)
    );
    this.addSettingTab(new CyclesSettingTab(this.app, this));
  }

  async onunload(): Promise<void> {
    this.screenshotService.dispose();
    this.app.workspace.detachLeavesOfType(CYCLES_VIEW_TYPE);
  }

  async activateView(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(CYCLES_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: CYCLES_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof CyclesView) {
      await leaf.view.refreshFromState();
    }
  }

  async recordVisit(notePath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(notePath);
    if (!(file instanceof TFile) || file.extension !== "md") {
      throw new Error("Cycles could not find that note.");
    }

    this.suppressedMetadataRefreshes.add(notePath);
    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter.visited = formatVisitedProperty(new Date());
      });
    } catch (error) {
      this.suppressedMetadataRefreshes.delete(notePath);
      throw error;
    } finally {
      window.setTimeout(
        () => this.suppressedMetadataRefreshes.delete(notePath),
        1_500
      );
    }
  }

  async extendCycle(notePath: string, extension: ParsedCycle): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(notePath);
    if (!(file instanceof TFile) || file.extension !== "md") {
      throw new Error("Cycles could not find that note.");
    }

    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      const parsed = parseCycle(frontmatter.cycle);
      if (parsed.kind !== "cycle") {
        throw new Error("That note no longer has a valid cycle.");
      }
      frontmatter.cycle = extendCycleValue(parsed.cycle, extension);
      delete frontmatter.rest_until;
    });
  }

  async resetVisit(notePath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(notePath);
    if (!(file instanceof TFile) || file.extension !== "md") {
      throw new Error("Cycles could not find that note.");
    }

    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      delete frontmatter.visited;
    });
  }

  captureMissingImages(): void {
    if (!this.settings.captureMissingImages) return;
    this.screenshotService.enqueue(
      this.cycleIndex
        .getAllCycleNotes()
        .filter(
          (note): note is typeof note & { url: string } =>
            Boolean(note.url)
        )
        .map((note) => ({
          file: note.file,
          url: note.url,
          image: note.image
        }))
    );
  }

  async refreshViews(): Promise<void> {
    const views = this.app.workspace.getLeavesOfType(CYCLES_VIEW_TYPE);
    await Promise.all(
      views.map(async (leaf) => {
        const view = leaf.view;
        if (view instanceof CyclesView) await view.render();
      })
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as StoredSettings | null;
    this.legacyFolder = legacyStorageFolder(loaded?.storageFolder);
    this.settings = {
      mediaFolder:
        typeof loaded?.mediaFolder === "string"
          ? normalizeMediaFolder(loaded.mediaFolder)
          : DEFAULT_SETTINGS.mediaFolder,
      showCycleDuration:
        typeof loaded?.showCycleDuration === "boolean"
          ? loaded.showCycleDuration
          : DEFAULT_SETTINGS.showCycleDuration,
      showWebsiteDomain:
        typeof loaded?.showWebsiteDomain === "boolean"
          ? loaded.showWebsiteDomain
          : DEFAULT_SETTINGS.showWebsiteDomain,
      showPlatformIcons:
        typeof loaded?.showPlatformIcons === "boolean"
          ? loaded.showPlatformIcons
          : DEFAULT_SETTINGS.showPlatformIcons,
      captureMissingImages:
        typeof loaded?.captureMissingImages === "boolean"
          ? loaded.captureMissingImages
          : DEFAULT_SETTINGS.captureMissingImages,
      legacyVisitMigrationCompleted:
        typeof loaded?.legacyVisitMigrationCompleted === "boolean"
          ? loaded.legacyVisitMigrationCompleted
          : DEFAULT_SETTINGS.legacyVisitMigrationCompleted
    };
  }
}
