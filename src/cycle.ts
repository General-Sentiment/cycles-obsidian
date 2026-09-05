export type CycleUnit = "day" | "week" | "month" | "year";

export interface ParsedCycle {
  amount: number;
  unit: CycleUnit;
  source: string;
  label: string;
  parts?: Array<{ amount: number; unit: CycleUnit }>;
}

export type CycleParseResult =
  | { kind: "cycle"; cycle: ParsedCycle }
  | { kind: "disabled" }
  | { kind: "invalid"; reason: string };

const UNIT_ALIASES: Record<string, CycleUnit> = {
  d: "day",
  day: "day",
  days: "day",
  w: "week",
  week: "week",
  weeks: "week",
  m: "month",
  month: "month",
  months: "month",
  y: "year",
  year: "year",
  years: "year"
};

export function parseCycle(value: unknown): CycleParseResult {
  if (value === null || value === undefined || value === false) {
    return { kind: "disabled" };
  }

  if (typeof value !== "string") {
    return {
      kind: "invalid",
      reason: "Cycle must be a duration such as 7d, 2w, 3m, or 1y."
    };
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "never" || normalized === "off") {
    return { kind: "disabled" };
  }

  const segments = normalized.split(/\s*\+\s*|\s+(?=\d)/);
  if (segments.length > 1) {
    const parts: Array<{ amount: number; unit: CycleUnit }> = [];
    const labels: string[] = [];
    for (const segment of segments) {
      const parsed = parseCycle(segment);
      if (parsed.kind !== "cycle") return { kind: "invalid", reason: `Unsupported cycle "${value}".` };
      parts.push({ amount: parsed.cycle.amount, unit: parsed.cycle.unit });
      labels.push(parsed.cycle.label);
    }
    const first = parts[0]!;
    return { kind: "cycle", cycle: { ...first, source: normalized, label: labels.join(" "), parts } };
  }

  const match = /^(\d+)\s*(d|days?|w|weeks?|m|months?|y|years?)$/.exec(normalized);
  if (!match) {
    return {
      kind: "invalid",
      reason: `Unsupported cycle "${value}". Use 7d, 2w, 3m, 1y, or never.`
    };
  }

  const amount = Number.parseInt(match[1] ?? "", 10);
  const unit = UNIT_ALIASES[match[2] ?? ""];
  if (!Number.isSafeInteger(amount) || amount < 1 || !unit) {
    return {
      kind: "invalid",
      reason: "Cycle duration must be a positive whole number."
    };
  }

  return {
    kind: "cycle",
    cycle: {
      amount,
      unit,
      source: normalized,
      label: `${amount} ${unit}${amount === 1 ? "" : "s"}`
    }
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function addMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getDate();
  const targetMonthIndex = result.getMonth() + months;
  const targetYear = result.getFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  result.setDate(1);
  result.setFullYear(targetYear);
  result.setMonth(targetMonth);
  result.setDate(Math.min(originalDay, daysInMonth(targetYear, targetMonth)));
  return result;
}

export function startOfLocalDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addCycle(date: Date, cycle: ParsedCycle): Date {
  if (cycle.parts) {
    // Apply calendar months before fixed days so month lengths stay meaningful.
    let months = 0;
    let days = 0;
    for (const part of cycle.parts) {
      if (part.unit === "year") months += part.amount * 12;
      else if (part.unit === "month") months += part.amount;
      else days += part.amount * (part.unit === "week" ? 7 : 1);
    }
    const result = addMonthsClamped(date, months);
    result.setDate(result.getDate() + days);
    return startOfLocalDay(result);
  }
  let result = new Date(date);

  switch (cycle.unit) {
    case "day":
      result.setDate(result.getDate() + cycle.amount);
      break;
    case "week":
      result.setDate(result.getDate() + cycle.amount * 7);
      break;
    case "month":
      result = addMonthsClamped(result, cycle.amount);
      break;
    case "year":
      result = addMonthsClamped(result, cycle.amount * 12);
      break;
  }

  return startOfLocalDay(result);
}

export function calculateNextDue(
  lastVisitedAt: unknown,
  cycle: ParsedCycle
): Date | null {
  const visited = parseVisitedDate(lastVisitedAt);
  return visited ? addCycle(visited, cycle) : null;
}

export function extendCycleValue(cycle: ParsedCycle, extension: ParsedCycle): string {
  let months = 0;
  let days = 0;
  for (const part of [...(cycle.parts ?? [cycle]), ...(extension.parts ?? [extension])]) {
    if (part.unit === "year") months += part.amount * 12;
    else if (part.unit === "month") months += part.amount;
    else days += part.amount * (part.unit === "week" ? 7 : 1);
  }
  if (!Number.isSafeInteger(months) || !Number.isSafeInteger(days)) {
    throw new Error("Cycle duration is too large.");
  }
  // Keep extended cycles compact: four accumulated weeks become a calendar month.
  months += Math.floor(days / 28);
  days %= 28;
  if (!Number.isSafeInteger(months)) {
    throw new Error("Cycle duration is too large.");
  }
  const label = (amount: number, unit: CycleUnit) => `${amount} ${unit}${amount === 1 ? "" : "s"}`;
  const parts: string[] = [];
  if (months) parts.push(months % 12 === 0 ? label(months / 12, "year") : label(months, "month"));
  if (days) parts.push(days % 7 === 0 ? label(days / 7, "week") : label(days, "day"));
  return parts.join(" ");
}

export function parseVisitedDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value);
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  const localDate = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(trimmed);
  if (localDate) {
    const year = Number(localDate[1]);
    const month = Number(localDate[2]);
    const day = Number(localDate[3]);
    const parsed = new Date(year, month - 1, day);
    return parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day
      ? parsed
      : null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatVisitedProperty(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isDue(dueAt: Date | null, now = new Date()): boolean {
  return dueAt === null || dueAt.getTime() <= now.getTime();
}

export function formatDueDate(dueAt: Date | null, now = new Date()): string {
  if (!dueAt) return "Never visited";

  const today = startOfLocalDay(now).getTime();
  const dueDay = startOfLocalDay(dueAt).getTime();
  const dayDifference = Math.round((dueDay - today) / 86_400_000);

  if (dayDifference === 0) return "Due today";
  if (dayDifference === -1) return "1 day overdue";
  if (dayDifference < -1) return `${Math.abs(dayDifference)} days overdue`;
  if (dayDifference === 1) return "Due tomorrow";
  return `Due in ${dayDifference} days`;
}

export function formatLastVisited(lastVisitedAt?: unknown): string {
  const visited = parseVisitedDate(lastVisitedAt);
  if (!visited) return "Never visited";

  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(visited);
  return `Last visited ${formatted}`;
}
