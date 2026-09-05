import { formatVisitedProperty, parseCycle } from "./cycle";
import { parseHttpUrl } from "./url";

export function cycleNoteName(title: string): string {
  const name = title.replace(/[\\/:*?"<>|#\[\]\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ").trim().replace(/^\.+|[. ]+$/g, "").slice(0, 160).trim();
  return name || "New cycle note";
}

export function newCycleNoteContent(title: string, url: string, cycle: string, description: string, now = new Date()): string {
  const parsed = parseCycle(cycle);
  if (parsed.kind !== "cycle") throw new Error("Enter a cycle such as 2 weeks or 1 month.");
  const validUrl = parseHttpUrl(url);
  if (!validUrl) throw new Error("Enter a valid HTTP or HTTPS URL.");
  return ["---", `title: ${JSON.stringify(title.trim())}`, `url: ${JSON.stringify(validUrl)}`,
    `cycle: ${JSON.stringify(parsed.cycle.label)}`, `visited: ${formatVisitedProperty(now)}`,
    ...(description.trim() ? [`description: ${JSON.stringify(description.trim())}`] : []), "---", ""].join("\n");
}
