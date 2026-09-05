import { describe, expect, it } from "vitest";
import { parseLegacyVisitRecord } from "../src/legacy-record";

describe("parseLegacyVisitRecord", () => {
  it("reads current visit shards", () => {
    const result = parseLegacyVisitRecord({
      notePath: "references/Jane.md",
      lastVisitedAt: "2026-08-04T18:00:00.000Z"
    });
    expect(result?.notePath).toBe("references/Jane.md");
    expect(result?.lastVisitedAt.toISOString()).toBe("2026-08-04T18:00:00.000Z");
  });

  it("reads version-one review shards", () => {
    expect(
      parseLegacyVisitRecord({
        notePath: "references/Jane.md",
        lastReviewedAt: "2026-07-01T12:00:00.000Z"
      })?.lastVisitedAt.toISOString()
    ).toBe("2026-07-01T12:00:00.000Z");
  });

  it("rejects malformed records", () => {
    expect(parseLegacyVisitRecord({ notePath: "Jane.md" })).toBeNull();
    expect(parseLegacyVisitRecord({ lastVisitedAt: "2026-08-04" })).toBeNull();
  });
});
