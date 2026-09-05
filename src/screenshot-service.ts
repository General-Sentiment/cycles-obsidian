import { App, Platform, TFile, normalizePath, requestUrl } from "obsidian";
import {
  DEFAULT_MEDIA_FOLDER,
  getPreviewPaths,
  unwrapImageReference
} from "./screenshot-path";

interface ScreenshotCandidate {
  file: TFile;
  url: string;
  image: string | null;
}

interface NativeImageLike {
  crop(rect: { x: number; y: number; width: number; height: number }): NativeImageLike;
  getSize(): { width: number; height: number };
  isEmpty(): boolean;
  resize(options: { width: number; height: number; quality: "best" }): NativeImageLike;
  toJPEG(quality: number): Uint8Array;
}

interface NativeImageFactory {
  createFromBuffer(buffer: Uint8Array): NativeImageLike;
}

interface CaptureWebContents {
  capturePage(): Promise<NativeImageLike>;
  executeJavaScript(code: string): Promise<unknown>;
  setWindowOpenHandler(handler: () => { action: "deny" }): void;
}

interface CaptureWindow {
  webContents: CaptureWebContents;
  destroy(): void;
  loadURL(url: string): Promise<void>;
}

interface BrowserWindowConstructor {
  new (options: Record<string, unknown>): CaptureWindow;
}

interface ElectronRemote {
  BrowserWindow: BrowserWindowConstructor;
}

function hasImageValue(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export class ScreenshotService {
  private readonly attemptedPaths = new Set<string>();
  private readonly queuedPaths = new Set<string>();
  private readonly queue: ScreenshotCandidate[] = [];
  private running = false;
  private disposed = false;

  constructor(
    private readonly app: App,
    private readonly getMediaFolder: () => string = () => DEFAULT_MEDIA_FOLDER
  ) {}

  resetAttempts(): void {
    this.attemptedPaths.clear();
  }

  enqueue(candidates: ScreenshotCandidate[]): void {
    if (!Platform.isDesktopApp || this.disposed) return;

    for (const candidate of candidates) {
      if (
        !this.shouldProcess(candidate) ||
        this.attemptedPaths.has(candidate.file.path) ||
        this.queuedPaths.has(candidate.file.path)
      ) {
        continue;
      }
      this.queue.push(candidate);
      this.queuedPaths.add(candidate.file.path);
    }

    void this.drain();
  }

  dispose(): void {
    this.disposed = true;
    this.queue.length = 0;
    this.queuedPaths.clear();
  }

  private async drain(): Promise<void> {
    if (this.running || this.disposed) return;
    this.running = true;

    try {
      while (!this.disposed) {
        const candidate = this.queue.shift();
        if (!candidate) break;
        this.queuedPaths.delete(candidate.file.path);
        this.attemptedPaths.add(candidate.file.path);

        try {
          await this.captureCandidate(candidate);
        } catch (error) {
          console.warn(`Cycles could not capture ${candidate.url}`, error);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async captureCandidate(candidate: ScreenshotCandidate): Promise<void> {
    const currentFile = this.app.vault.getAbstractFileByPath(candidate.file.path);
    if (!(currentFile instanceof TFile)) return;

    const mediaFolder = this.getMediaFolder();
    const paths = getPreviewPaths(currentFile.path, currentFile.basename, mediaFolder);
    const currentImage = this.getCurrentImage(currentFile);
    const currentKind = this.getImageKind(currentImage, paths);
    if (currentKind === "custom" || currentKind === "social") return;

    let imageData: ArrayBuffer | null = null;
    let imagePath: string | null = null;

    try {
      const socialUrl = await this.findSocialImageUrl(candidate.url);
      if (socialUrl) {
        imageData = await this.downloadAndCropImage(socialUrl);
        imagePath = paths.social;
      }
    } catch (error) {
      console.warn(`Cycles could not use a social image for ${candidate.url}`, error);
    }

    if (!imageData || !imagePath) {
      if (currentKind === "screenshot") return;
      imageData = await this.captureUrl(candidate.url);
      imagePath = paths.screenshot;
    }
    if (this.disposed) return;

    await this.ensureFolder(mediaFolder);
    await this.writeImage(imagePath, imageData);

    await this.app.fileManager.processFrontMatter(currentFile, (frontmatter) => {
      const latestKind = this.getImageKind(frontmatter.image, paths);
      if (latestKind === "missing" || latestKind === "screenshot") {
        frontmatter.image = `[[${imagePath}]]`;
      }
    });
  }

  private shouldProcess(candidate: ScreenshotCandidate): boolean {
    const paths = getPreviewPaths(
      candidate.file.path,
      candidate.file.basename,
      this.getMediaFolder()
    );
    const kind = this.getImageKind(candidate.image, paths);
    return kind === "missing" || kind === "screenshot";
  }

  private getCurrentImage(file: TFile): unknown {
    return this.app.metadataCache.getFileCache(file)?.frontmatter?.image;
  }

  private getImageKind(
    value: unknown,
    paths: ReturnType<typeof getPreviewPaths>
  ): "missing" | "custom" | "screenshot" | "social" {
    if (!hasImageValue(value)) return "missing";
    const reference = normalizePath(unwrapImageReference(value));
    if (reference === normalizePath(paths.social)) return "social";
    if (
      reference === normalizePath(paths.screenshot) ||
      reference === normalizePath(paths.legacy)
    ) {
      return "screenshot";
    }
    return "custom";
  }

  private async findSocialImageUrl(pageUrl: string): Promise<string | null> {
    const response = await this.withTimeout(
      requestUrl({
        url: pageUrl,
        headers: {
          Accept: "text/html,application/xhtml+xml"
        },
        throw: false
      }),
      12_000
    );
    if (response.status < 200 || response.status >= 400) return null;

    const document = new DOMParser().parseFromString(response.text, "text/html");
    const selectors = [
      'meta[property="og:image:secure_url"]',
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
      'meta[property="twitter:image"]',
      'meta[name="twitter:image:src"]'
    ];

    for (const selector of selectors) {
      const content = document.querySelector<HTMLMetaElement>(selector)?.content?.trim();
      if (!content) continue;
      try {
        const resolved = new URL(content, pageUrl);
        if (resolved.protocol === "http:" || resolved.protocol === "https:") {
          return resolved.href;
        }
      } catch {
        // Try the next supported social-image field.
      }
    }

    const imageSrc = document
      .querySelector<HTMLLinkElement>('link[rel="image_src"]')
      ?.getAttribute("href")
      ?.trim();
    if (!imageSrc) return null;
    try {
      const resolved = new URL(imageSrc, pageUrl);
      return resolved.protocol === "http:" || resolved.protocol === "https:"
        ? resolved.href
        : null;
    } catch {
      return null;
    }
  }

  private async downloadAndCropImage(url: string): Promise<ArrayBuffer> {
    const response = await this.withTimeout(
      requestUrl({ url, throw: false }),
      12_000
    );
    if (response.status < 200 || response.status >= 400) {
      throw new Error(`Social image returned HTTP ${response.status}.`);
    }
    if (response.arrayBuffer.byteLength > 20 * 1024 * 1024) {
      throw new Error("Social image exceeds the 20 MB limit.");
    }

    const electron = require("electron") as {
      nativeImage?: NativeImageFactory;
    };
    if (!electron.nativeImage) {
      throw new Error("Electron nativeImage is unavailable.");
    }

    const image = electron.nativeImage.createFromBuffer(
      new Uint8Array(response.arrayBuffer)
    );
    if (image.isEmpty()) throw new Error("Social image could not be decoded.");

    const { width, height } = image.getSize();
    const side = Math.min(width, height);
    const square = image.crop({
      x: Math.floor((width - side) / 2),
      y: Math.floor((height - side) / 2),
      width: side,
      height: side
    });
    const jpeg = square
      .resize({ width: 512, height: 512, quality: "best" })
      .toJPEG(84);
    return Uint8Array.from(jpeg).buffer;
  }

  private async writeImage(path: string, data: ArrayBuffer): Promise<void> {
    const normalized = normalizePath(path);
    const existing = this.app.vault.getAbstractFileByPath(normalized);
    if (existing instanceof TFile) {
      await this.app.vault.modifyBinary(existing, data);
    } else {
      await this.app.vault.createBinary(normalized, data);
    }
  }

  private async captureUrl(url: string): Promise<ArrayBuffer> {
    const electron = require("electron") as { remote?: ElectronRemote };
    const BrowserWindow = electron.remote?.BrowserWindow;
    if (!BrowserWindow) {
      throw new Error("Electron BrowserWindow is unavailable.");
    }

    const captureWindow = new BrowserWindow({
      show: false,
      frame: false,
      width: 720,
      height: 720,
      useContentSize: true,
      webPreferences: {
        offscreen: true,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        partition: "cycles-screenshots"
      }
    });

    try {
      captureWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      await this.withTimeout(captureWindow.loadURL(url), 15_000);
      await captureWindow.webContents.executeJavaScript("window.scrollTo(0, 0)");
      await new Promise<void>((resolve) => window.setTimeout(resolve, 700));
      const image = await captureWindow.webContents.capturePage();
      const jpeg = image
        .resize({ width: 512, height: 512, quality: "best" })
        .toJPEG(84);
      return Uint8Array.from(jpeg).buffer;
    } finally {
      captureWindow.destroy();
    }
  }

  private async ensureFolder(folder: string): Promise<void> {
    if (await this.app.vault.adapter.exists(folder)) return;

    const segments = folder.split("/");
    let current = "";
    for (const segment of segments) {
      current = current ? normalizePath(`${current}/${segment}`) : segment;
      if (!(await this.app.vault.adapter.exists(current))) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error("Screenshot timed out.")),
        timeoutMs
      );
      promise.then(
        (value) => {
          window.clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          window.clearTimeout(timer);
          reject(error);
        }
      );
    });
  }
}
