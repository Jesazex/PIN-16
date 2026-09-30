const fs = require("fs");
const path = require("path");
const { getControlDeadlineCandidates, pickControlDeadlines } = require("./deadlinesUtils");

const deadlinesClientSource = fs
  .readFileSync(path.join(__dirname, "deadlinesCore.js"), "utf8")
  .replace(/\nif \(typeof module === "object"[\s\S]*$/, "\n");

function jsonForInlineScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// Put your computations here.

function userComputed(data) {
  const candidates = getControlDeadlineCandidates(data);
  return {
    controlDeadlines: pickControlDeadlines(candidates),
    controlDeadlineCandidatesJson: jsonForInlineScript(candidates),
    deadlinesClientSource,
  };
}

exports.userComputed = userComputed;
exports.deadlinesClientSource = deadlinesClientSource;
