import { describe, it, expect } from "vitest";
import {
  parseDateHeading,
  resolveUpcomingDate,
  daysUntil,
  relativeSuffix,
  nearestAdjective,
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
  });
});
