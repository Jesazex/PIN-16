const fs = require("fs");
const { applyPathPrefix } = require("./pathPrefix");

// Runs after Eleventy and Sass both finish. Doing this inside eleventy.after
// races the parallel Sass build and can leave CSS urls unprefixed.
const outDir = "dist";
if (!fs.existsSync(outDir)) {
  process.exit(0);
}

const changed = applyPathPrefix(outDir, process.env.PATH_PREFIX);
fs.writeFileSync(`${outDir}/.nojekyll`, "");
if (changed) {
  console.log(`[pages] Prefixed root urls in ${changed} files (${process.env.PATH_PREFIX})`);
}
