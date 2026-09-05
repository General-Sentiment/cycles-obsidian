import { describe, expect, it } from "vitest";
import { cycleNoteName, newCycleNoteContent } from "../src/new-cycle-note";

describe("new cycle notes", () => {
  it.each([
    ["A title / with: forbidden? characters", "A title with forbidden characters"],
    ["../outside/vault", "outside vault"],
    ["...", "New cycle note"],
    ["  A   title  ", "A title"]
  ])("uses a safe filename for %s", (input, expected) => expect(cycleNoteName(input)).toBe(expected));

  it("quotes fetched metadata and starts the cycle today", () => {
    const content = newCycleNoteContent('A "title"\n---', "https://example.com/?a=1&b=2", "1 month 2 weeks", "Text:\ncycle: never", new Date(2026, 8, 4));
    expect(content).toContain('title: "A \\"title\\"\\n---"');
    expect(content).toContain('description: "Text:\\ncycle: never"');
    expect(content).toContain('cycle: "1 month 2 weeks"');
    expect(content).toContain('visited: 2026-09-04');
    expect(content.match(/^---$/gm)).toHaveLength(2);
  });

  it.each(["", "never", "wrong", "0 days"])("rejects inactive or invalid cycle %s", (cycle) => {
    expect(() => newCycleNoteContent("Title", "https://example.com", cycle, "")).toThrow();
  });

  it("rejects non-web URLs", () => {
    expect(() => newCycleNoteContent("Title", "javascript:alert(1)", "2w", "")).toThrow();
  });
});
