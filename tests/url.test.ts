import { describe, expect, it } from "vitest";
import { parseHttpUrl, formatWebsiteDomain } from "../src/url";

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

describe("formatWebsiteDomain", () => {
  it.each([
    ["https://www.instagram.com/person/?a=1#section", "instagram.com"],
    ["http://WWW.Example.COM/", "example.com"],
    ["https://artist.bandcamp.com/album/test", "artist.bandcamp.com"],
    ["https://www.are.na./person/channel", "are.na"],
    ["https://example.com:8080/path", "example.com"],
    [null, null],
    ["javascript:alert(1)", null]
  ])("formats %s", (input, expected) => {
    expect(formatWebsiteDomain(input)).toBe(expected);
  });
});
