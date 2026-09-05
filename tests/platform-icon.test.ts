import { describe, expect, it } from "vitest";
import { getPlatformIcon } from "../src/platform-icon";

describe("platform icons", () => {
  it.each([
    ["https://www.are.na/person/channel", "Are.na"],
    ["https://are.na/block/123", "Are.na"],
    ["https://sander.are.na/person/channel", "Are.na"],
    ["https://www.youtube.com/watch?v=abc", "YouTube"],
    ["https://youtu.be/abc", "YouTube"],
    ["https://www.instagram.com/person", "Instagram"],
    ["https://INSTAGRAM.COM./person", "Instagram"],
    ["https://artist.bandcamp.com/album/test", "Bandcamp"],
    ["https://open.spotify.com/artist/test", "Spotify"],
    ["https://twitter.com/person", "X"],
    ["https://x.com/person", "X"],
    ["https://writer.substack.com", "Substack"],
    ["https://soundcloud.com/person", "SoundCloud"],
    ["https://www.tiktok.com/@person", "TikTok"],
    ["https://bsky.app/profile/person", "Bluesky"],
    ["https://threads.net/@person", "Threads"],
    ["https://vimeo.com/123", "Vimeo"],
    ["https://redd.it/abc", "Reddit"],
    ["https://github.com/person", "GitHub"],
    ["https://fb.watch/abc", "Facebook"],
    ["https://twitch.tv/person", "Twitch"],
    ["https://pin.it/abc", "Pinterest"]
  ])("identifies %s", (url, expected) => {
    expect(getPlatformIcon(url)?.title).toBe(expected);
    expect(getPlatformIcon(url)?.path).toBeTruthy();
  });

  it.each([null, "", "invalid", "javascript:alert(1)", "https://example.com",
    "https://are.na.example.com", "https://notare.na", "https://notyoutube.com", "https://instagram.com.example.com", "https://example.com/youtube.com",
    "https://youtube.com@example.com"])('does not misidentify %s', (url) => {
    expect(getPlatformIcon(url)).toBeNull();
  });
});
