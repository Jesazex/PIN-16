const fs = require("fs");
const path = require("path");

const PREFIXABLE = new Set([
  ".html",
  ".css",
  ".js",
  ".json",
  ".xml",
  ".svg",
  ".webmanifest",
]);

/**
 * Normalize a site path prefix such as "/PIN16".
 * Empty, missing, and "/" mean the site is served from the domain root.
 */
function normalizePrefix(prefix) {
  if (prefix == null) return "";
  let value = String(prefix).trim();
  if (!value || value === "/") return "";
  if (!value.startsWith("/")) value = `/${value}`;
  if (value.endsWith("/")) value = value.slice(0, -1);
  const parts = value.split("/").slice(1);
  const safe = parts.every(
    (part) => part && part !== "." && part !== ".." && /^[A-Za-z0-9._~-]+$/.test(part)
  );
  if (!safe) {
    throw new Error(`Invalid PATH_PREFIX: ${prefix}`);
  }
  return value;
}

/**
 * Rewrite root-absolute URLs so a project site under /PIN16 can load
 * styles, scripts, and note links. Leaves protocol-relative URLs, already
 * prefixed paths, and ordinary "16px / 1.5" CSS alone.
 */
function prefixRootUrls(text, prefix) {
  const normalized = normalizePrefix(prefix);
  if (!normalized || typeof text !== "string" || !text) return text;
  const token = normalized
    .slice(1)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const skip = `(?!\\/|${token}\\/)`;
  const quoted = new RegExp(`(?<=["'(])\\/${skip}`, "g");
  const afterComma = new RegExp(`(?<=,\\s*)\\/${skip}`, "g");
  const cssUrl = new RegExp(`(?<=url\\(\\s*)\\/${skip}`, "g");
  return text
    .replace(quoted, `${normalized}/`)
    .replace(afterComma, `${normalized}/`)
    .replace(cssUrl, `${normalized}/`);
}

function applyPathPrefix(dir, prefix) {
  const normalized = normalizePrefix(prefix);
  if (!normalized || !fs.existsSync(dir)) return 0;
  let changed = 0;

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!PREFIXABLE.has(path.extname(entry.name).toLowerCase())) continue;
      const original = fs.readFileSync(full, "utf8");
      const next = prefixRootUrls(original, normalized);
      if (next !== original) {
        fs.writeFileSync(full, next);
        changed += 1;
      }
    }
  }

  walk(dir);
  return changed;
}

module.exports = { normalizePrefix, prefixRootUrls, applyPathPrefix };
