import { describe, expect, it } from "vitest";
import { getCategoryIcon } from "../src/category-icon";

describe("getCategoryIcon", () => {
  it("maps people wikilinks to a user icon", () => {
    expect(getCategoryIcon(["[[People]]", "[[Artists]]"])).toBe("user");
    expect(getCategoryIcon("Person")).toBe("user");
  });

  it.each([
    ["[[Photographers]]", "camera"],
    ["[[Designers]]", "palette"],
    ["[[Runners]]", "activity"],
    ["[[Engineers]]", "code-2"],
    ["[[Music]]", "music"],
    ["[[Architecture]]", "building-2"]
  ])("maps %s to %s", (category, icon) => {
    expect(getCategoryIcon(category)).toBe(icon);
  });

  it("uses a generic note icon for unknown or missing categories", () => {
    expect(getCategoryIcon("Unmapped category")).toBe("file-text");
    expect(getCategoryIcon(undefined)).toBe("file-text");
  });
});
