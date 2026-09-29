import { describe, it, expect } from "vitest";
import {
  parseDateHeading,
  resolveUpcomingDate,
  daysUntil,
  relativeSuffix,
  nearestAdjective,
  moscowToday,
  extractHeadings,
  getControlDeadlines,
} from "./deadlinesUtils.js";

describe("deadlinesUtils", () => {
  it("parses На <day> <month> headings", () => {
    expect(parseDateHeading("На 15 сентября")).toEqual({
      day: 15,
      month: 8,
      displayDate: "15 сентября",
      heading: "На 15 сентября",
    });
    expect(parseDateHeading("Тема без даты")).toBeNull();
  });

  it("rolls past dates into next year", () => {
    const today = new Date(2026, 8, 27); // 27 Sep 2026
    const past = resolveUpcomingDate(15, 8, today); // 15 Sep
    expect(past.getFullYear()).toBe(2027);
    const future = resolveUpcomingDate(28, 8, today);
    expect(future.getFullYear()).toBe(2026);
    expect(daysUntil(future, today)).toBe(1);
    expect(daysUntil(resolveUpcomingDate(27, 8, today), today)).toBe(0);
  });

  it("formats Russian relative day suffixes", () => {
    expect(relativeSuffix(0)).toBe("Сегодня");
    expect(relativeSuffix(1)).toBe("1 день");
    expect(relativeSuffix(3)).toBe("3 дня");
    expect(relativeSuffix(5)).toBe("5 дней");
    expect(relativeSuffix(21)).toBe("21 день");
    expect(relativeSuffix(22)).toBe("22 дня");
    expect(relativeSuffix(25)).toBe("25 дней");
  });

  it("picks gender for nearest adjective", () => {
    expect(nearestAdjective("ДЗ")).toBe("Ближайшее");
    expect(nearestAdjective("БДЗ")).toBe("Ближайшее");
    expect(nearestAdjective("КР")).toBe("Ближайшая");
    expect(nearestAdjective("ЛР")).toBe("Ближайшая");
    expect(nearestAdjective("Экзамен")).toBe("Ближайшее");
    expect(nearestAdjective("Контрольная")).toBe("Ближайшая");
  });

  it("extracts markdown headings without a trailing dollar", () => {
    expect(extractHeadings("## На 17 Сентября\nтекст\n## На 1 Октября\n")).toEqual([
      "На 17 Сентября",
      "На 1 Октября",
    ]);
  });

  it("treats today as the Moscow calendar day on any server timezone", () => {
    // 28 Sep 2026 22:00 UTC is 29 Sep 2026 01:00 in Moscow.
    const instant = new Date(Date.UTC(2026, 8, 28, 22, 0, 0));
    const today = moscowToday(instant);
    expect(today.getFullYear()).toBe(2026);
    expect(today.getMonth()).toBe(8);
    expect(today.getDate()).toBe(29);
    expect(daysUntil(resolveUpcomingDate(29, 8, today), today)).toBe(0);
    expect(daysUntil(resolveUpcomingDate(1, 9, today), today)).toBe(2);
    expect(relativeSuffix(daysUntil(resolveUpcomingDate(29, 8, today), today))).toBe(
      "Сегодня"
    );
  });

  it("builds deadline lines from control-form notes", () => {
    const today = moscowToday(new Date(Date.UTC(2026, 8, 28, 22, 0, 0)));
    const lines = getControlDeadlines(
      {
        collections: {
          note: [
            {
              filePathStem: "/notes/Формы контроля/ДЗ/Физика",
              url: "/formy-kontrolya/dz/fizika/",
              template: {
                inputContent: "## На 17 сентября\n\n## На 1 октября\n",
              },
            },
          ],
        },
      },
      today
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].label).toBe("Ближайшее ДЗ:");
    expect(lines[0].linkText).toBe("1 октября - Физика (2 дня)");
    expect(lines[0].days).toBe(2);
    expect(lines[0].href).toContain("#");
  });
});
