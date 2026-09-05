const ICON_RULES: Array<{ terms: string[]; icon: string }> = [
  { terms: ["person", "people"], icon: "user" },
  { terms: ["photographer", "photographers", "photography"], icon: "camera" },
  { terms: ["filmmaker", "filmmakers", "film"], icon: "film" },
  { terms: ["musician", "musicians", "music", "dj", "djs"], icon: "music" },
  {
    terms: ["architect", "architects", "architecture", "landscape architects"],
    icon: "building-2"
  },
  {
    terms: ["artist", "artists", "designer", "designers", "illustrator", "illustrators"],
    icon: "palette"
  },
  {
    terms: ["writer", "writers", "editorial", "publisher", "publishers"],
    icon: "book-open"
  },
  { terms: ["engineer", "engineers", "technology", "software"], icon: "code-2" },
  {
    terms: ["researcher", "researchers", "educator", "educators", "education"],
    icon: "graduation-cap"
  },
  { terms: ["founder", "founders", "consultant", "consultants", "business"], icon: "briefcase" },
  {
    terms: [
      "runner",
      "runners",
      "athlete",
      "athletes",
      "cyclist",
      "cyclists",
      "hiking",
      "skier",
      "skiers",
      "snowboarder",
      "snowboarders",
      "climber",
      "climbers"
    ],
    icon: "activity"
  },
  { terms: ["wine"], icon: "wine" },
  { terms: ["culture"], icon: "sparkles" }
];

function normalizeCategory(value: string): string {
  const trimmed = value.trim();
  const wikilink = /^\[\[([^|\]#]+)(?:#[^|\]]+)?(?:\|[^\]]+)?\]\]$/u.exec(trimmed);
  return (wikilink?.[1] ?? trimmed).trim().toLowerCase();
}

export function getCategoryIcon(value: unknown): string {
  const values = Array.isArray(value) ? value : [value];
  const categories = values
    .filter((category): category is string => typeof category === "string")
    .map(normalizeCategory)
    .filter(Boolean);

  for (const rule of ICON_RULES) {
    if (categories.some((category) => rule.terms.includes(category))) {
      return rule.icon;
    }
  }
  return "file-text";
}
