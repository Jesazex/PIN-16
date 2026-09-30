import { describe, it, expect } from "vitest";
import fs from "fs";
import vm from "vm";
import path from "path";
import { fileURLToPath } from "url";
import {
  parseDateHeading,
  resolveUpcomingDate,
  daysUntil,
  relativeSuffix,
  nearestAdjective,
  isPastControlDate,
  markPastControlSections,
  moscowToday,
  extractHeadings,
  getControlDeadlines,
  getControlDeadlineCandidates,
  pickControlDeadlines,
} from "./deadlinesUtils.js";

const here = path.dirname(fileURLToPath(import.meta.url));

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

  it("treats a control date as past only before Moscow today", () => {
    const today = new Date(2026, 8, 30);
    expect(isPastControlDate("На 25 Сентября", today)).toBe(true);
    expect(isPastControlDate("На 30 Сентября", today)).toBe(false);
    expect(isPastControlDate("На 1 Октября", today)).toBe(false);
    expect(isPastControlDate("Тема без даты", today)).toBe(false);
    const moscowSep30 = moscowToday(new Date(Date.UTC(2026, 8, 29, 22, 0, 0)));
    expect(isPastControlDate("На 29 Сентября", moscowSep30)).toBe(true);
    expect(isPastControlDate("На 30 сентября", moscowSep30)).toBe(false);
  });

  it("dims a passed heading and the text under it, not the following date", () => {
    const classesOf = () => {
      const names = new Set();
      return {
        add(name) {
          names.add(name);
        },
        contains(name) {
          return names.has(name);
        },
      };
    };
    const el = (tag, text) => ({ tagName: tag, textContent: text, classList: classesOf() });
    const header = el("HEADER", "");
    const pastHeading = el("H2", "На 16 Сентября");
    const pastBody = el("UL", "занятие");
    const todayHeading = el("H2", "На 30 Сентября");
    const todayBody = el("UL", "занятие");
    const futureHeading = el("H2", "На 1 Октября");
    markPastControlSections(
      {
        children: [header, pastHeading, pastBody, todayHeading, todayBody, futureHeading],
      },
      new Date(2026, 8, 30)
    );
    expect(header.classList.contains("dg-past-deadline")).toBe(false);
    expect(pastHeading.classList.contains("dg-past-deadline")).toBe(true);
    expect(pastBody.classList.contains("dg-past-deadline")).toBe(true);
    expect(todayHeading.classList.contains("dg-past-deadline")).toBe(false);
    expect(todayBody.classList.contains("dg-past-deadline")).toBe(false);
    expect(futureHeading.classList.contains("dg-past-deadline")).toBe(false);
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

  it("recomputes the nearest line when Moscow today changes", () => {
    const data = {
      collections: {
        note: [
          {
            filePathStem: "/notes/Формы контроля/ДЗ/Физика",
            url: "/formy-kontrolya/dz/fizika/",
            template: {
              inputContent: "## На 17 сентября\n\n## На 1 октября\n",
            },
          },
          {
            filePathStem: "/notes/Формы контроля/ДЗ/Матан",
            url: "/formy-kontrolya/dz/matan/",
            template: {
              inputContent: "## На 30 сентября\n",
            },
          },
        ],
      },
    };
    const september29 = moscowToday(new Date(Date.UTC(2026, 8, 28, 22, 0, 0)));
    const october1 = moscowToday(new Date(Date.UTC(2026, 8, 30, 21, 0, 0)));
    const candidates = getControlDeadlineCandidates(data);

    expect(candidates.some((item) => "days" in item)).toBe(false);
    expect(getControlDeadlines(data, september29)[0].linkText).toBe(
      "30 сентября - Матан (1 день)"
    );
    expect(pickControlDeadlines(candidates, october1)[0].linkText).toBe(
      "1 октября - Физика (Сегодня)"
    );
  });

  it("runs the inlined browser bundle without Node globals", () => {
    const source = fs.readFileSync(path.join(here, "deadlinesCore.js"), "utf8");
    const clientSource = source.replace(/\nif \(typeof module === "object"[\s\S]*$/, "\n");
    const sandbox = {};
    vm.runInNewContext(clientSource, sandbox);
    const today = sandbox.dgDeadlinesApi.moscowToday(new Date(Date.UTC(2026, 8, 30, 21, 0, 0)));
    const lines = sandbox.dgDeadlinesApi.pickControlDeadlines(
      [{ typeName: "ЛР", subjectName: "Физика", day: 1, month: 9, displayDate: "1 октября", href: "/#x" }],
      today
    );
    expect(lines[0].linkText).toBe("1 октября - Физика (Сегодня)");
    expect(sandbox.module).toBeUndefined();
  });
});
