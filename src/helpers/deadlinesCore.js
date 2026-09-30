/**
 * Deadline day math shared by the Eleventy build and the browser.
 * The build inlines this file so each visit recomputes "today" in Moscow.
 * Keep the browser bundle free of Node APIs.
 */
var dgDeadlinesApi = (function () {
  var MONTHS = {
    января: 0,
    февраля: 1,
    марта: 2,
    апреля: 3,
    мая: 4,
    июня: 5,
    июля: 6,
    августа: 7,
    сентября: 8,
    октября: 9,
    ноября: 10,
    декабря: 11,
  };

  var FEMININE_TYPES = { КР: true, ЛР: true };
  var MOSCOW_TZ = "Europe/Moscow";

  function moscowYMD(instant) {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: MOSCOW_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    function get(type) {
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === type) return Number(parts[i].value);
      }
      return NaN;
    }
    return { y: get("year"), m: get("month") - 1, d: get("day") };
  }

  /** Local Date whose calendar day is the Moscow calendar day of `now`. */
  function moscowToday(now) {
    var ymd = moscowYMD(now || new Date());
    return new Date(ymd.y, ymd.m, ymd.d);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function calendarUTC(date) {
    var day = startOfDay(date);
    return Date.UTC(day.getFullYear(), day.getMonth(), day.getDate());
  }

  function parseDateHeading(heading) {
    if (!heading || typeof heading !== "string") return null;
    var match = heading.trim().match(/^На\s+(\d{1,2})\s+([А-Яа-яёЁ]+)\s*$/i);
    if (!match) return null;
    var day = parseInt(match[1], 10);
    var monthToken = match[2].toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(MONTHS, monthToken) || day < 1 || day > 31) {
      return null;
    }
    return {
      day: day,
      month: MONTHS[monthToken],
      displayDate: day + " " + monthToken,
      heading: heading.trim(),
    };
  }

  function resolveUpcomingDate(day, month, today) {
    var today0 = startOfDay(today || moscowToday());
    var candidate = new Date(today0.getFullYear(), month, day);
    if (candidate < today0) {
      candidate = new Date(today0.getFullYear() + 1, month, day);
    }
    return candidate;
  }

  function daysUntil(target, today) {
    var a = calendarUTC(today || moscowToday());
    var b = calendarUTC(target);
    return Math.round((b - a) / 86400000);
  }

  function relativeSuffix(days) {
    if (days === 0) return "Сегодня";
    var n = Math.abs(days);
    var mod10 = n % 10;
    var mod100 = n % 100;
    var word;
    if (mod100 >= 11 && mod100 <= 14) word = "дней";
    else if (mod10 === 1) word = "день";
    else if (mod10 >= 2 && mod10 <= 4) word = "дня";
    else word = "дней";
    return n + " " + word;
  }

  function nearestAdjective(typeName) {
    if (FEMININE_TYPES[typeName]) return "Ближайшая";
    var lower = String(typeName || "").toLowerCase();
    if (/[ая]я$/i.test(lower)) return "Ближайшая";
    return "Ближайшее";
  }

  /**
   * Pick the soonest upcoming date per control type.
   * `candidates` are undated-relative: {typeName, subjectName, day, month, displayDate, href}.
   */
  function pickControlDeadlines(candidates, today) {
    var today0 = today || moscowToday();
    var byType = new Map();
    var list = candidates || [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!byType.has(item.typeName)) byType.set(item.typeName, []);
      byType.get(item.typeName).push(item);
    }

    var lines = [];
    byType.forEach(function (items, typeName) {
      var best = null;
      for (var j = 0; j < items.length; j++) {
        var candidate = items[j];
        var when = resolveUpcomingDate(candidate.day, candidate.month, today0);
        var days = daysUntil(when, today0);
        if (days < 0) continue;
        if (
          !best ||
          days < best.days ||
          (days === best.days &&
            String(candidate.subjectName).localeCompare(best.subjectName, "ru") < 0)
        ) {
          best = {
            subjectName: candidate.subjectName,
            displayDate: candidate.displayDate,
            href: candidate.href,
            days: days,
          };
        }
      }
      if (!best) return;
      var adj = nearestAdjective(typeName);
      lines.push({
        typeName: typeName,
        adjective: adj,
        label: adj + " " + typeName + ":",
        linkText: best.displayDate + " - " + best.subjectName + " (" + relativeSuffix(best.days) + ")",
        href: best.href,
        days: best.days,
      });
    });

    lines.sort(function (a, b) {
      return a.days - b.days || String(a.typeName).localeCompare(b.typeName, "ru");
    });
    return lines;
  }

  return {
    moscowToday: moscowToday,
    parseDateHeading: parseDateHeading,
    resolveUpcomingDate: resolveUpcomingDate,
    daysUntil: daysUntil,
    relativeSuffix: relativeSuffix,
    nearestAdjective: nearestAdjective,
    pickControlDeadlines: pickControlDeadlines,
  };
})();

if (typeof module === "object" && module.exports) {
  module.exports = dgDeadlinesApi;
}
