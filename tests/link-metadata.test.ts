import { describe, expect, it, vi } from "vitest";
vi.mock("obsidian", () => ({ requestUrl: vi.fn() }));
import { readLinkMetadata } from "../src/link-metadata";

function page(values: Record<string, string>, title = "Page title"): Document {
  return { querySelector(selector: string) {
    if (selector === "title") return { textContent: title };
    return values[selector] ? { getAttribute: () => values[selector] } : null;
  } } as unknown as Document;
}

describe("link metadata", () => {
  it("prefers social metadata and resolves relative images", () => {
    const result = readLinkMetadata(page({
      'meta[property="og:title"]': "Social\n title",
      'meta[property="og:description"]': "Description",
      'meta[property="og:image"]': "/preview.jpg"
    }), "https://example.com/article");
    expect(result).toEqual({url:"https://example.com/article",title:"Social title",description:"Description",imageUrl:"https://example.com/preview.jpg"});
  });
  it("falls back to page title and then domain", () => {
    expect(readLinkMetadata(page({}), "https://example.com").title).toBe("Page title");
    expect(readLinkMetadata(page({}, ""), "https://www.example.com").title).toBe("example.com");
  });
  it("does not use executable image URLs", () => {
    expect(readLinkMetadata(page({'meta[property="og:image"]': "javascript:alert(1)"}), "https://example.com").imageUrl).toBeNull();
  });
});
