# Cycles Obsidian

Bring notes and saved links back when it’s time to revisit them.

## Getting started

Run **Cycles: Add Cycle Note** from the command palette to paste a URL, fetch its title and preview, and confirm the title and cycle period. Examples such as `2 weeks` and `1 month` are shown in the dialog. The note opens with its media saved locally and its cycle starting today.

Or add a `cycle` property to any existing note:

```yaml
---
cycle: 2w
---
```

Open **Cycles** from the ribbon or command palette. Click a row to open its URL, or the note if there’s no URL. Cycles records the visit, dims the row, and hides it after refresh until it’s due again.

Use durations like `7d`, `2w`, `3m`, or `1y`. Mixed durations such as `1 month 2 weeks` also work. Set `cycle: never` to stop resurfacing a note.

## Row actions

Right-click a row to:

- **Open note** — open the underlying note.
- **Mark visited** — start the next cycle without opening anything. Option/Alt+click does the same.
- **Extend cycle** — increase the recurring duration. Every four accumulated weeks becomes a calendar month.
- **Reset visit** — clear a visit made in the current sidebar session.
- **Delete** — use Obsidian’s normal deletion and attachment handling.

The header switches between due notes and all cycling notes. Extended rows stay visible until refresh.

## Settings

Show or hide cycle durations, website domains, and platform icons. Enable webpage previews and choose where to save them (default: `media/cycles/`). Custom `image` properties are preserved.

## Installation

Desktop Obsidian only. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/General-Sentiment/cycles-obsidian/releases/latest), place them in `<vault>/.obsidian/plugins/cycles/`, and enable Cycles under **Settings → Community plugins**.

## Network use and privacy

Scheduling and visit tracking stay in your vault. No account, payment, or telemetry is required or used.

**Add Cycle Note** fetches details and media from the URL you provide when you run it. **Capture missing images** is on by default. It requests your saved URLs and their image hosts; screenshot fallbacks load pages and their third-party resources in a hidden, sandboxed browser. Those sites receive ordinary web requests, including your IP address. Disable the setting to stop automatic preview requests. Remote `image` URLs still load when displayed, and clicking a URL row opens that website. Generated previews are saved in your vault; platform icons are bundled locally.

## Development

```bash
npm install
npm test
npm run build
```

Copy the build files into your vault’s plugin folder to try changes.

## License

[MIT](LICENSE). Simple Icons assets use CC0; the Are.na mark comes from its website. Brand marks belong to their respective owners.
