import {
  siYoutube, siInstagram, siX, siThreads, siSpotify, siBandcamp,
  siSoundcloud, siTiktok, siBluesky, siSubstack, siVimeo, siReddit,
  siGithub, siFacebook, siTwitch, siPinterest
} from "simple-icons";
import { parseHttpUrl } from "./url";

export interface PlatformIcon {
  title: string;
  path: string;
}

const PLATFORMS: Array<{ domains: string[]; icon: PlatformIcon }> = [
  { domains: ["youtube.com", "youtu.be", "youtube-nocookie.com"], icon: siYoutube },
  { domains: ["instagram.com", "instagr.am"], icon: siInstagram },
  { domains: ["x.com", "twitter.com"], icon: siX },
  { domains: ["threads.net", "threads.com"], icon: siThreads },
  { domains: ["spotify.com", "spotify.link"], icon: siSpotify },
  { domains: ["bandcamp.com"], icon: siBandcamp },
  { domains: ["soundcloud.com"], icon: siSoundcloud },
  { domains: ["tiktok.com"], icon: siTiktok },
  { domains: ["bsky.app"], icon: siBluesky },
  { domains: ["substack.com"], icon: siSubstack },
  { domains: ["vimeo.com"], icon: siVimeo },
  { domains: ["reddit.com", "redd.it"], icon: siReddit },
  { domains: ["github.com"], icon: siGithub },
  { domains: ["facebook.com", "fb.com", "fb.watch"], icon: siFacebook },
  { domains: ["twitch.tv"], icon: siTwitch },
  { domains: ["pinterest.com", "pin.it"], icon: siPinterest }
];

export function getPlatformIcon(value: unknown): PlatformIcon | null {
  const url = parseHttpUrl(value);
  if (!url) return null;
  const hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
  return PLATFORMS.find(({ domains }) =>
    domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  )?.icon ?? null;
}
