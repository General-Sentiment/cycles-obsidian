import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type CyclesPlugin from "./main";
import { normalizeMediaFolder } from "./screenshot-path";

export class CyclesSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: CyclesPlugin) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();
    this.containerEl.createEl("h2", { text: "Cycles" });
    this.containerEl.createEl("h3", { text: "Appearance" });

    new Setting(this.containerEl)
      .setName("Show cycle duration")
      .setDesc("Show values such as “Every 3 months” in each due-note row.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showCycleDuration)
          .onChange(async (value) => {
            this.plugin.settings.showCycleDuration = value;
            await this.plugin.saveSettings();
            await this.plugin.refreshViews();
          })
      );

    new Setting(this.containerEl)
      .setName("Show website domain")
      .setDesc("Show the website domain below each title, or “Note” when there is no URL.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showWebsiteDomain)
          .onChange(async (value) => {
            this.plugin.settings.showWebsiteDomain = value;
            await this.plugin.saveSettings();
            await this.plugin.refreshViews();
          })
      );

    new Setting(this.containerEl)
      .setName("Show platform icons")
      .setDesc("Show platform logos such as YouTube and Instagram before website domains.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showPlatformIcons)
          .onChange(async (value) => {
            this.plugin.settings.showPlatformIcons = value;
            await this.plugin.saveSettings();
            await this.plugin.refreshViews();
          })
      );

    this.containerEl.createEl("h3", { text: "Media" });

    new Setting(this.containerEl)
      .setName("Media folder")
      .setDesc(
        "Vault folder for newly generated previews. Existing image files and note references are not moved."
      )
      .addText((text) => {
        text.setPlaceholder("media/cycles").setValue(this.plugin.settings.mediaFolder);
        text.inputEl.addEventListener("change", () => {
          void (async () => {
            try {
              const mediaFolder = normalizeMediaFolder(text.getValue());
              this.plugin.settings.mediaFolder = mediaFolder;
              text.setValue(mediaFolder);
              await this.plugin.saveSettings();
              this.plugin.screenshotService.resetAttempts();
              this.plugin.captureMissingImages();
            } catch (error) {
              text.setValue(this.plugin.settings.mediaFolder);
              new Notice(
                error instanceof Error ? error.message : "Could not change media folder."
              );
            }
          })();
        });
      });

    new Setting(this.containerEl)
      .setName("Placeholder icons")
      .setDesc(
        "When no image is available, show a square placeholder based on the note's category or categories property—for example, Person or People uses a user icon. Unknown categories use a note icon."
      );

    new Setting(this.containerEl)
      .setName("Capture missing images")
      .setDesc(
        "On desktop, save social images locally when available, falling back to square webpage screenshots. Custom image properties are never overwritten."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.captureMissingImages)
          .onChange(async (value) => {
            this.plugin.settings.captureMissingImages = value;
            await this.plugin.saveSettings();
            if (value) this.plugin.captureMissingImages();
          })
      );

  }
}
