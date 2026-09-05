import { describe, expect, it } from "vitest";
import {
  getPreviewPaths,
  normalizeMediaFolder,
  unwrapImageReference
} from "../src/screenshot-path";

describe("getScreenshotPath", () => {
  it("creates a deterministic, vault-relative JPEG path", () => {
    const first = getPreviewPaths("references/People/Jane Doe.md", "Jane Doe");
    const second = getPreviewPaths("references/People/Jane Doe.md", "Jane Doe");
    expect(first).toEqual(second);
    expect(first.social).toMatch(
      /^media\/cycles\/jane-doe-[a-z0-9]{7}-social\.jpg$/u
    );
    expect(first.screenshot).toMatch(
      /^media\/cycles\/jane-doe-[a-z0-9]{7}-screenshot\.jpg$/u
    );
  });

  it("distinguishes duplicate basenames by note path", () => {
    expect(getPreviewPaths("one/Same.md", "Same")).not.toEqual(
      getPreviewPaths("two/Same.md", "Same")
    );
  });

  it("uses a configured media folder", () => {
    expect(getPreviewPaths("Jane.md", "Jane", "assets/cycles").social).toMatch(
      /^assets\/cycles\/jane-[a-z0-9]{7}-social\.jpg$/u
    );
  });

  it("normalizes safe vault folders and rejects unsafe ones", () => {
    expect(normalizeMediaFolder(" media//cycles/ ")).toBe("media/cycles");
    expect(normalizeMediaFolder("")).toBe("media/cycles");
    expect(() => normalizeMediaFolder("../outside")).toThrow();
    expect(() => normalizeMediaFolder("/.hidden")).toThrow();
    expect(() => normalizeMediaFolder(".obsidian/cycles")).toThrow();
  });

  it("sanitizes punctuation and diacritics", () => {
    expect(getPreviewPaths("Élan!.md", "Élan!").legacy).toMatch(
      /^media\/cycles\/elan-[a-z0-9]{7}\.jpg$/u
    );
  });

  it("unwraps Obsidian image references", () => {
    expect(unwrapImageReference("[[media/cycles/example.jpg]]")).toBe(
      "media/cycles/example.jpg"
    );
    expect(unwrapImageReference("![[media/example.jpg|Cover]]")).toBe(
      "media/example.jpg"
    );
  });
});
