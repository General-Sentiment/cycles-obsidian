import { describe, expect, it } from "vitest";
import { parseHttpUrl } from "../src/url";

describe("parseHttpUrl", () => {
  it.each([
    ["https://example.com/path", "https://example.com/path"],
    [" http://example.com ", "http://example.com/"]
  ])("accepts %s", (input, expected) => {
    expect(parseHttpUrl(input)).toBe(expected);
  });

  it.each([
    "javascript:alert(1)",
    "file:///tmp/private",
    "ftp://example.com",
    "not a url",
    "",
    null,
    42
  ])("rejects %s", (input) => {
    expect(parseHttpUrl(input)).toBeNull();
  });
});
