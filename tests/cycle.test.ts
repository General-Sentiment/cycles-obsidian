import { describe, expect, it } from "vitest";
import {
  addCycle,
  calculateNextDue,
  extendCycleValue,
  formatDueDate,
  formatLastVisited,
  formatVisitedProperty,
  isDue,
  parseCycle,
  parseVisitedDate,
  type ParsedCycle
} from "../src/cycle";

function cycle(amount: number, unit: ParsedCycle["unit"]): ParsedCycle {
  return { amount, unit, source: `${amount}${unit[0]}`, label: `${amount} ${unit}` };
}

describe("parseCycle", () => {
  it.each([
    ["7d", 7, "day"],
    ["2 weeks", 2, "week"],
    ["3M", 3, "month"],
    ["1 year", 1, "year"]
  ] as const)("parses %s", (input, amount, unit) => {
    const result = parseCycle(input);
    expect(result.kind).toBe("cycle");
    if (result.kind === "cycle") {
      expect(result.cycle.amount).toBe(amount);
      expect(result.cycle.unit).toBe(unit);
    }
  });

  it.each(["never", "off", "", false, null, undefined])("disables %s", (input) => {
    expect(parseCycle(input).kind).toBe("disabled");
  });

  it.each(["weekly", "0d", "-2w", 7])("rejects %s", (input) => {
    expect(parseCycle(input).kind).toBe("invalid");
  });
});

describe("cycle scheduling", () => {
  it.each([
    ["1 month", 1, "month", "2 months"],
    ["1 month", 2, "month", "3 months"],
    ["1 month", 3, "month", "4 months"],
    ["1 month", 1, "week", "1 month 1 week"],
    ["1 month", 2, "week", "1 month 2 weeks"],
    ["6 weeks", 1, "week", "7 weeks"],
    ["1 year", 1, "month", "13 months"],
    ["1 month 1 week", 1, "week", "1 month 2 weeks"],
    ["10 days", 1, "week", "17 days"]
  ] as const)("extends %s by %i %s", (value, amount, unit, expected) => {
    const parsed = parseCycle(value);
    expect(parsed.kind).toBe("cycle");
    if (parsed.kind !== "cycle") return;
    const result = extendCycleValue(parsed.cycle, cycle(amount, unit));
    expect(result).toBe(expected);
    expect(parseCycle(result).kind).toBe("cycle");
  });

  it("schedules mixed cycles with calendar months before weeks", () => {
    for (const value of ["1 month 1 week", "1w + 1m"]) {
      const parsed = parseCycle(value);
      expect(parsed.kind).toBe("cycle");
      if (parsed.kind !== "cycle") continue;
      expect(calculateNextDue("2026-01-31", parsed.cycle)).toEqual(new Date(2026, 2, 7));
      expect(calculateNextDue(undefined, parsed.cycle)).toBeNull();
    }
  });

  it.each(["1 month 0 weeks", "1 month + off", "1 month -2 weeks", "1m +"])(
    "rejects malformed mixed cycle %s", (value) => {
      expect(parseCycle(value).kind).toBe("invalid");
    }
  );

  it("adds calendar days and returns local midnight", () => {
    const result = addCycle(new Date(2026, 7, 4, 17, 42), cycle(7, "day"));
    expect(result).toEqual(new Date(2026, 7, 11, 0, 0, 0, 0));
  });

  it("clamps month-end dates", () => {
    const result = addCycle(new Date(2025, 0, 31, 12), cycle(1, "month"));
    expect(result).toEqual(new Date(2025, 1, 28, 0, 0, 0, 0));
  });

  it("clamps leap day when adding a year", () => {
    const result = addCycle(new Date(2024, 1, 29, 12), cycle(1, "year"));
    expect(result).toEqual(new Date(2025, 1, 28, 0, 0, 0, 0));
  });

  it("treats a missing visit as immediately due", () => {
    expect(isDue(null, new Date(2026, 7, 4))).toBe(true);
  });

  it("rejects a corrupt visit timestamp", () => {
    expect(calculateNextDue("not-a-date", cycle(1, "week"))).toBeNull();
  });

  it("parses Obsidian date properties in local time", () => {
    expect(parseVisitedDate("2026-08-04")).toEqual(new Date(2026, 7, 4));
    expect(parseVisitedDate("2026-02-30")).toBeNull();
  });

  it("writes Obsidian date properties", () => {
    expect(formatVisitedProperty(new Date(2026, 7, 4, 23, 59))).toBe("2026-08-04");
  });

  it("formats relative due dates", () => {
    const now = new Date(2026, 7, 4, 12);
    expect(formatDueDate(new Date(2026, 7, 4), now)).toBe("Due today");
    expect(formatDueDate(new Date(2026, 7, 3), now)).toBe("1 day overdue");
    expect(formatDueDate(new Date(2026, 7, 7), now)).toBe("Due in 3 days");
  });

  it("formats the last visited date", () => {
    expect(formatLastVisited()).toBe("Never visited");
    expect(formatLastVisited("not-a-date")).toBe("Never visited");
    expect(formatLastVisited("2026-08-04T18:00:00.000Z")).toMatch(
      /^Last visited /u
    );
  });
});
