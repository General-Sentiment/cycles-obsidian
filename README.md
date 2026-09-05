# Cycles Obsidian

Cycles resurfaces notes according to two small frontmatter properties.

## Note format

```yaml
---
cycle: 2w
visited: 2026-08-04
---
```

Supported values are positive whole numbers followed by `d`, `w`, `m`, or `y`. Long forms such as `2 weeks` also work. Use `cycle: never` to opt out without deleting the property.

Notes with a valid cycle and no `visited` date are due immediately. Opening a note or using its **Visit** URL action updates the note's `visited` property using Obsidian's `YYYY-MM-DD` date format. The row dims for the current sidebar session and disappears after refresh until its next cycle is due.

When upgrading from the shard-based version, Cycles copies existing visit dates from `cycle-data/notes/` into their notes once. It leaves the legacy folder untouched as a backup but no longer reads or writes it afterward.

The plugin settings independently control whether each row shows its cycle duration and last-visited date.

The sidebar header can switch between due notes and all notes with a valid `cycle` property. In the all-notes view, due notes appear first and upcoming notes follow in next-due order.

Right-click any row and choose **Delete** to use Obsidian's standard note deletion flow, including its configured confirmation, trash location, and unlinked attachment handling. Canceling the confirmation keeps the note. Rows visited during the current sidebar session also offer **Reset visit**.

The **Extend cycle** submenu permanently adds 1 week, 2 weeks, 1 month, 2 months, or 3 months to the note's `cycle` property. For example, `1 month` plus a month becomes `2 months`, and `1 month` plus a week becomes `1 month 1 week`. Mixed durations apply calendar months first, then days or weeks. The last-visited date stays unchanged.

On desktop, Cycles can capture missing webpage previews locally. It prefers Open Graph and Twitter social images, center-crops them to square JPEGs, and falls back to a square webpage screenshot. The media folder is configurable and defaults to `media/cycles/`; changing it affects new captures without moving existing files. The note's `image` property becomes an Obsidian wikilink such as `[[media/cycles/example-abc1234-social.jpg]]`. Any custom `image` value is treated as an override and is never replaced. The image appears as a small square thumbnail in its due-note row.

When no usable image exists, the row still shows a clickable square placeholder. Cycles reads either `category` or `categories` and chooses an Obsidian icon—for example, Person or People uses a user icon, photography uses a camera, music uses a music icon, and athletic categories use an activity icon. Unknown or missing categories use a generic note icon.

## Commands

- **Cycles: Open due notes**
- **Cycles: Mark active note visited**

## Development

```bash
npm install
npm test
npm run build
```

Copy or symlink `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/cycles/`, then enable the plugin in Obsidian.
