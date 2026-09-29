const fs = require("fs");
const { headerToId } = require("./utils");

const ROOT_FOLDER = "Формы контроля";

const MONTHS = {
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

const FEMININE_TYPES = new Set(["КР", "ЛР"]);

/** 
 * Нормализует любую дату, переводя её в полночь по Московскому времени (MSK).
 * Это гарантирует корректную работу кода на зарубежных серверах.
 */
function startOfMoscowDay(date) {
  // Переводим системное время в строковое представление по часовому поясу Москвы
  const mskString = date.toLocaleString("en-US", { timeZone: "Europe/Moscow" });
  const mskDate = new Date(mskString);
  
  // Возвращаем дату, сброшенную на локальную полночь
  return new Date(mskDate.getFullYear(), mskDate.getMonth(), mskDate.getDate());
}

/** Сохраняем оригинальное имя функции для совместимости с остальным кодом */
function startOfDay(date) {
  return startOfMoscowDay(date);
}

function parseDateHeading(heading) {
  if (!heading || typeof heading !== "string") return null;
  const match = heading.trim().match(/^На\s+(\d{1,2})\s+([А-Яа-яёЁ]+)\s*\$/i);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const monthToken = match[2].toLowerCase();
  if (!(monthToken in MONTHS) || day < 1 || day > 31) return null;
  return {
    day,
    month: MONTHS[monthToken],
    displayDate: `${day} ${monthToken}`,
    heading: heading.trim(),
  };
}

/** Вычисляет предстоящую дату с учетом года в московском часовом поясе */
function resolveUpcomingDate(day, month, today = new Date()) {
  const today0 = startOfMoscowDay(today);
  
  // Создаем дату-кандидата, используя текущий год в Москве
  let candidate = new Date(today0.getFullYear(), month, day);
  
  if (candidate < today0) {
    candidate = new Date(today0.getFullYear() + 1, month, day);
  }
  return candidate;
}

/** Безопасно считает разницу в календарных днях без влияния часовых поясов и перевода часов */
function daysUntil(target, today = new Date()) {
  const mskToday = startOfMoscowDay(today);
  const mskTarget = startOfMoscowDay(target);
  
  // Конвертируем московские полночи в чистый UTC-таймстамп для точного вычитания
  const a = Date.UTC(mskToday.getFullYear(), mskToday.getMonth(), mskToday.getDate());
  const b = Date.UTC(mskTarget.getFullYear(), mskTarget.getMonth(), mskTarget.getDate());
  
  // Вычисляем чистую разницу в днях
  return Math.floor((b - a) / 86400000);
}

function relativeSuffix(days) {
  if (days === 0) return "Сегодня";
  const n = Math.abs(days);
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word;
  if (mod100 >= 11 && mod100 <= 14) word = "дней";
  else if (mod10 === 1) word = "день";
  else if (mod10 >= 2 && mod10 <= 4) word = "дня";
  else word = "дней";
  return `${n} ${word}`;
}

function nearestAdjective(typeName) {
  if (FEMININE_TYPES.has(typeName)) return "Ближайшая";
  const lower = String(typeName || "").toLowerCase();
  if (/[ая]я\$/i.test(lower)) return "Ближайшая";
  return "Ближайшее";
}

function extractHeadings(markdown) {
  if (!markdown) return [];
  const headings = [];
  const re = /^(#{1,6})\s+(.+?)\s*\$/gm;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    headings.push(m[2].trim());
  }
  return headings;
}

function stripFrontMatter(raw) {
  if (!raw) return "";
  return String(raw).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function readNoteBody(item) {
  if (item.inputPath && fs.existsSync(item.inputPath)) {
    try {
      return stripFrontMatter(fs.readFileSync(item.inputPath, "utf8"));
    } catch {
      // fall through
    }
  }
  if (item.template && typeof item.template.inputContent === "string") {
    return stripFrontMatter(item.template.inputContent);
  }
  return "";
}

function notePathParts(item) {
  const stem = (item.filePathStem || "").replace(/^\/?notes\//, "");
  return stem.split("/").filter(Boolean);
}

/**
 * Собирает строки ближайших дедлайнов из заметок в папке "Формы контроля".
 */
function getControlDeadlines(data, today = new Date()) {
  const notes = (data.collections && data.collections.note) || [];
  const byType = new Map();

  for (const item of notes) {
    const parts = notePathParts(item);
    if (parts.length < 3) continue;
    if (parts[0] !== ROOT_FOLDER) continue;

    const typeName = parts[1];
    const subjectName = parts[parts.length - 1];
    const body = readNoteBody(item);
    const headings = extractHeadings(body);

    if (!byType.has(typeName)) byType.set(typeName, []);
    byType.get(typeName).push({
      subjectName,
      permalink: item.url || "/",
      headings,
    });
  }

  if (byType.size === 0) return [];

  const lines = [];
  for (const [typeName, subjects] of byType.entries()) {
    let best = null;
    for (const subject of subjects) {
      for (const heading of subject.headings) {
        const parsed = parseDateHeading(heading);
        if (!parsed) continue;
        const when = resolveUpcomingDate(parsed.day, parsed.month, today);
        const days = daysUntil(when, today);
        if (days < 0) continue;
        if (
          !best ||
          days < best.days ||
          (days === best.days &&
            subject.subjectName.localeCompare(best.subjectName, "ru") < 0)
        ) {
          best = {
            typeName,
            subjectName: subject.subjectName,
            permalink: subject.permalink,
            heading: parsed.heading,
            displayDate: parsed.displayDate,
            days,
            headingId: headerToId(parsed.heading),
          };
        }
      }
    }
    if (!best) continue;
    const adj = nearestAdjective(typeName);
    lines.push({
      typeName,
      adjective: adj,
      label: `${adj} ${typeName}:`,
      linkText: `${best.displayDate} - ${best.subjectName} (${relativeSuffix(best.days)})`,
      href: `${best.permalink}#${best.headingId}`,
      days: best.days,
    });
  }

  lines.sort(
    (a, b) => a.days - b.days || a.typeName.localeCompare(b.typeName, "ru")
  );
  return lines;
}

module.exports = {
  ROOT_FOLDER,
  parseDateHeading,
  resolveUpcomingDate,
  daysUntil,
  relativeSuffix,
  nearestAdjective,
  extractHeadings,
  getControlDeadlines,
};
