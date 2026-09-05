import { Modal, Notice, Setting } from "obsidian";
import type CyclesPlugin from "./main";
import { addCycle, parseCycle } from "./cycle";
import { fetchLinkMetadata, type LinkMetadata } from "./link-metadata";
import { parseHttpUrl } from "./url";
import type { PreparedPreview } from "./screenshot-service";

export class AddCycleUrlModal extends Modal {
  private closed = false;
  private loading = false;

  constructor(private readonly plugin: CyclesPlugin) {
    super(plugin.app);
    plugin.register(() => this.close());
  }

  onOpen(): void {
    this.setTitle("Add Cycle Note");
    let value = "";
    const error = this.contentEl.createDiv({ cls: "cycles-form-error", attr: { role: "alert" } });
    const urlSetting = new Setting(this.contentEl).setName("URL").setDesc("Paste the link you want to revisit.");
    let input!: HTMLInputElement;
    urlSetting.addText((text) => {
      input = text.inputEl;
      text.setPlaceholder("https://example.com").onChange((next) => { value = next; error.empty(); });
      input.type = "url";
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); void fetch(); }
      });
    });
    let button!: import("obsidian").ButtonComponent;
    const fetch = async () => {
      if (this.loading) return;
      const raw = value.trim();
      const url = parseHttpUrl(raw) ?? (!/^[a-z][a-z\d+.-]*:/i.test(raw) && raw.includes(".") ? parseHttpUrl(`https://${raw}`) : null);
      if (!url) { error.setText("Enter a valid website URL."); input.focus(); return; }
      this.loading = true;
      input.disabled = true;
      button.setDisabled(true).setButtonText("Fetching details…");
      const metadata = await fetchLinkMetadata(url);
      if (this.closed) return;
      this.close();
      new ConfirmCycleNoteModal(this.plugin, metadata).open();
    };
    new Setting(this.contentEl).addButton((cancel) => cancel.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((next) => { button = next; next.setButtonText("Fetch details").setCta().onClick(() => void fetch()); });
    input.focus();
  }

  onClose(): void { this.closed = true; this.contentEl.empty(); }
}

export class ConfirmCycleNoteModal extends Modal {
  private closed = false;
  private saving = false;
  private previewUrl: string | null = null;

  constructor(private readonly plugin: CyclesPlugin, private readonly metadata: LinkMetadata) {
    super(plugin.app);
    plugin.register(() => this.close());
  }

  onOpen(): void {
    this.setTitle("Confirm cycle note");
    const { contentEl, metadata } = this;
    let title = metadata.title;
    let description = metadata.description;
    let duration = "2 weeks";
    contentEl.createEl("p", { text: metadata.url, cls: "cycles-add-url" });
    if (metadata.warning) contentEl.createEl("p", { text: metadata.warning, cls: "cycles-add-status" });
    const previewContainer = contentEl.createDiv({ cls: "cycles-add-preview" });
    const previewStatus = previewContainer.createEl("p", { text: "Fetching preview…", cls: "cycles-add-status", attr: { "aria-live": "polite" } });
    const preview: Promise<PreparedPreview | null> = this.plugin.screenshotService.preparePreview(metadata.url, metadata.imageUrl)
      .then((result) => {
        if (this.closed) return null;
        this.previewUrl = URL.createObjectURL(new Blob([result.data], { type: "image/jpeg" }));
        previewStatus.remove();
        previewContainer.createEl("img", { attr: { src: this.previewUrl, alt: "Website preview" } });
        return result;
      }).catch(() => {
        if (!this.closed) previewStatus.setText("Preview unavailable. You can still create the note.");
        return null;
      });
    new Setting(contentEl).setName("Note title").addText((text) => text.setValue(title).onChange((value) => { title = value; }));
    new Setting(contentEl).setName("Description").addTextArea((text) => text.setValue(description).onChange((value) => { description = value; }));
    let cycleInput!: import("obsidian").TextComponent;
    new Setting(contentEl).setName("Cycle period").setDesc("For example: 2 weeks, 1 month, or 1 month 2 weeks.")
      .addText((text) => { cycleInput = text; text.setValue(duration).setPlaceholder("2 weeks").onChange((value) => { duration = value; updateDue(); }); });
    const examples = contentEl.createDiv({ cls: "cycles-cycle-examples" });
    for (const example of ["1 week", "2 weeks", "1 month", "3 months"]) {
      examples.createEl("button", { text: example, attr: { type: "button" } }).addEventListener("click", () => {
        duration = example; cycleInput.setValue(example); updateDue();
      });
    }
    const due = contentEl.createEl("p", { cls: "cycles-add-status", attr: { "aria-live": "polite" } });
    const updateDue = () => {
      const cycle = parseCycle(duration);
      due.setText(cycle.kind === "cycle"
        ? `Starts today. Next visit: ${addCycle(new Date(), cycle.cycle).toLocaleDateString(undefined, { dateStyle: "medium" })}.`
        : "Enter a duration such as 2 weeks or 1 month.");
    };
    updateDue();
    const error = contentEl.createDiv({ cls: "cycles-form-error", attr: { role: "alert" } });
    new Setting(contentEl).addButton((cancel) => cancel.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((save) => save.setButtonText("Create note").setCta().onClick(async () => {
        if (this.saving) return;
        if (!title.trim()) { error.setText("Enter a note title."); return; }
        if (parseCycle(duration).kind !== "cycle") { error.setText("Enter a cycle such as 2 weeks or 1 month."); cycleInput.inputEl.focus(); return; }
        this.saving = true;
        save.setDisabled(true).setButtonText("Creating note…");
        const draft = { ...metadata, title: title.trim(), description: description.trim() };
        const cycle = duration;
        try {
          const image = await preview;
          if (this.closed) return;
          const file = await this.plugin.createCycleNote(draft, cycle, image);
          this.close();
          try { await this.app.workspace.getLeaf(false).openFile(file); }
          catch { new Notice(`Created ${file.basename}. Open it from the file explorer.`); }
        } catch (cause) {
          if (!this.closed) {
            error.setText(cause instanceof Error ? cause.message : "Could not create note.");
            save.setDisabled(false).setButtonText("Create note");
            this.saving = false;
          }
        }
      }));
  }

  onClose(): void {
    this.closed = true;
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.contentEl.empty();
  }
}
