import { ItemView, Menu, Notice, setIcon, type MenuItem, type TFile, type WorkspaceLeaf } from "obsidian";
import { formatLastVisited, type ParsedCycle } from "./cycle";
import type CyclesPlugin from "./main";
import { getPlatformIcon } from "./platform-icon";

export const CYCLES_VIEW_TYPE = "cycles-due-notes";

const CYCLE_EXTENSIONS: ParsedCycle[] = [
  { amount: 1, unit: "week", source: "1w", label: "1 week" },
  { amount: 2, unit: "week", source: "2w", label: "2 weeks" },
  { amount: 1, unit: "month", source: "1m", label: "1 month" },
  { amount: 2, unit: "month", source: "2m", label: "2 months" },
  { amount: 3, unit: "month", source: "3m", label: "3 months" }
];

export class CyclesView extends ItemView {
  private visitedPaths = new Set<string>();
  private retainedFiles = new Set<TFile>();
  private displayedFiles: TFile[] = [];
  private showAllNotes = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: CyclesPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return CYCLES_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Cycles";
  }

  getIcon(): string {
    return "refresh-cw";
  }

  async onOpen(): Promise<void> {
    await this.refreshFromState();
  }

  async refreshFromState(): Promise<void> {
    this.visitedPaths.clear();
    this.retainedFiles.clear();
    this.displayedFiles = [];
    await this.render();
    this.plugin.captureMissingImages();
  }

  async render(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("cycles-view");

    const header = container.createDiv({ cls: "cycles-header" });
    header.createEl("h2", { text: "Cycles" });
    const headerActions = header.createDiv({ cls: "cycles-header-actions" });
    const visibilityButton = headerActions.createEl("button", {
      cls: "clickable-icon cycles-header-button cycles-visibility-toggle",
      attr: {
        "aria-label": this.showAllNotes
          ? "Show due notes only"
          : "Show all cycling notes",
        "aria-pressed": String(this.showAllNotes)
      }
    });
    setIcon(visibilityButton, this.showAllNotes ? "clock-3" : "list");
    visibilityButton.addEventListener("click", () => {
      this.showAllNotes = !this.showAllNotes;
      void this.render();
    });

    const refreshButton = headerActions.createEl("button", {
      cls: "clickable-icon cycles-header-button cycles-refresh",
      attr: { "aria-label": "Refresh Cycles notes" }
    });
    setIcon(refreshButton, "refresh-cw");
    refreshButton.addEventListener("click", () => void this.refreshFromState());

    const notes = this.showAllNotes
      ? this.getAllNotesForSidebar()
      : this.getDueNotesForSidebar();
    this.displayedFiles = notes.map((note) => note.file);
    if (notes.length === 0) {
      const empty = container.createDiv({ cls: "cycles-empty" });
      empty.createEl("p", {
        text: this.showAllNotes
          ? "No cycling notes found."
          : "Nothing is due right now."
      });
      empty.createEl("small", {
        text: "Add a cycle property such as 7d or 2w to resurface a note."
      });
      return;
    }

    container.createEl("p", {
      cls: "cycles-summary",
      text: this.showAllNotes
        ? `${notes.length} cycling ${notes.length === 1 ? "note" : "notes"}`
        : `${notes.length} ${notes.length === 1 ? "note" : "notes"} ready to revisit`
    });

    const list = container.createDiv({ cls: "cycles-list" });
    for (const note of notes) {
      const item: HTMLElement = list.createEl(note.url ? "a" : "div", {
        cls: "cycles-item",
        attr: note.url
          ? { href: note.url, target: "_blank", rel: "noopener noreferrer", "aria-label": `Visit ${note.file.basename} URL` }
          : { role: "button", tabindex: "0", "aria-label": `Open ${note.file.basename}` }
      });
      item.addEventListener("click", () => {
        void this.markVisited(note.file.path, item);
        if (!note.url) void this.app.workspace.getLeaf(false).openFile(note.file);
      });
      if (!note.url) {
        item.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            item.click();
          }
        });
      }
      if (this.visitedPaths.has(note.file.path)) item.addClass("is-visited");
      item.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const menu = new Menu();
        menu.addItem((menuItem) => {
          menuItem.setTitle("Open note").setIcon("file-text").onClick(() => {
            void this.markVisited(note.file.path, item);
            void this.app.workspace.getLeaf(false).openFile(note.file);
          });
        });
        menu.addSeparator();
        menu.addItem((menuItem) => {
          menuItem.setTitle("Extend cycle").setIcon("clock-plus");
          // Obsidian exposes this at runtime but omits it from its public types.
          const submenu = (menuItem as MenuItem & { setSubmenu(): Menu }).setSubmenu();
          for (const extension of CYCLE_EXTENSIONS) {
            submenu.addItem((choice) => {
              choice.setTitle(`Add ${extension.label}`).onClick(() => {
                void this.extendCycle(note.file, extension);
              });
            });
          }
        });
        if (this.visitedPaths.has(note.file.path)) {
          menu.addItem((menuItem) => {
            menuItem
              .setTitle("Reset visit")
              .setIcon("rotate-ccw")
              .onClick(() => void this.resetVisit(note.file));
          });
        }
        menu.addSeparator();
        menu.addItem((menuItem) => {
          menuItem
            .setTitle("Delete")
            .setIcon("trash-2")
            .onClick(() => void this.deleteNote(note.file));
        });
        menu.showAtMouseEvent(event);
      });
      {
        const thumbnail = item.createDiv({ cls: "cycles-thumbnail", attr: { "aria-hidden": "true" } });
        if (note.imageSrc) {
          thumbnail.createEl("img", {
            attr: {
              src: note.imageSrc,
              alt: "",
              loading: "lazy"
            }
          });
        } else {
          thumbnail.addClass("is-placeholder");
          setIcon(thumbnail, note.placeholderIcon);
        }
      }
      const noteContent = item.createDiv({ cls: "cycles-note-content" });
      const title = noteContent.createDiv({ cls: "cycles-note-title" });
      const platform = this.plugin.settings.showPlatformIcons ? getPlatformIcon(note.url) : null;
      if (platform) {
        const icon = title.createSpan({
          cls: "cycles-platform-icon",
          attr: { "aria-hidden": "true", title: platform.title }
        });
        const svg = icon.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", platform.viewBox ?? "0 0 24 24");
        svg.setAttribute("fill", "currentColor");
        svg.setAttribute("focusable", "false");
        const path = icon.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", platform.path);
        svg.appendChild(path);
        icon.appendChild(svg);
      }
      title.createSpan({ cls: "cycles-note-title-text", text: note.file.basename });
      if (
        this.plugin.settings.showCycleDuration ||
        this.plugin.settings.showLastVisited
      ) {
        const metadata = noteContent.createDiv({ cls: "cycles-note-meta" });
        if (this.plugin.settings.showCycleDuration) {
          metadata.createSpan({ text: `Every ${note.cycle.label}` });
        }
        if (this.plugin.settings.showLastVisited) {
          metadata.createSpan({
            text: formatLastVisited(note.lastVisitedAt)
          });
        }
      }

    }
  }

  private getDueNotesForSidebar() {
    const notes = this.getAllNotesForSidebar().filter((note) =>
      note.due || this.visitedPaths.has(note.file.path) || this.retainedFiles.has(note.file)
    );
    if (this.retainedFiles.size > 0) {
      const positions = new Map(this.displayedFiles.map((file, index) => [file, index]));
      notes.sort((a, b) =>
        (positions.get(a.file) ?? Infinity) - (positions.get(b.file) ?? Infinity)
      );
    }
    return notes;
  }

  private getAllNotesForSidebar() {
    return this.plugin.cycleIndex.getAllCycleNotes().sort((a, b) => {
      if (a.due !== b.due) return a.due ? -1 : 1;
      if (!a.dueAt && b.dueAt) return -1;
      if (a.dueAt && !b.dueAt) return 1;
      const dueDifference =
        (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0);
      return dueDifference || a.file.basename.localeCompare(b.file.basename);
    });
  }

  private async markVisited(notePath: string, item: HTMLElement): Promise<void> {
    if (this.visitedPaths.has(notePath)) return;

    this.visitedPaths.add(notePath);
    item.addClass("is-visited");
    try {
      await this.plugin.recordVisit(notePath);
    } catch (error) {
      this.visitedPaths.delete(notePath);
      item.removeClass("is-visited");
      new Notice(error instanceof Error ? error.message : "Could not record visit.");
    }
  }

  private async extendCycle(file: TFile, extension: ParsedCycle): Promise<void> {
    const alreadyRetained = this.retainedFiles.has(file);
    this.retainedFiles.add(file);
    try {
      await this.plugin.extendCycle(file.path, extension);
    } catch (error) {
      if (!alreadyRetained) this.retainedFiles.delete(file);
      new Notice(error instanceof Error ? error.message : "Could not extend cycle.");
    }
  }

  private async deleteNote(file: TFile): Promise<void> {
    try {
      const deleted = await this.app.fileManager.promptForDeletion(file);
      if (!deleted) return;
      this.visitedPaths.delete(file.path);
      this.retainedFiles.delete(file);
      await this.render();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "Could not delete note.");
    }
  }

  private async resetVisit(file: TFile): Promise<void> {
    const alreadyRetained = this.retainedFiles.has(file);
    this.retainedFiles.add(file);
    try {
      await this.plugin.resetVisit(file.path);
      this.visitedPaths.delete(file.path);
      await this.render();
    } catch (error) {
      if (!alreadyRetained) this.retainedFiles.delete(file);
      new Notice(error instanceof Error ? error.message : "Could not reset visit.");
    }
  }
}
