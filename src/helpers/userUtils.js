const { getControlDeadlines } = require("./deadlinesUtils");

// Put your computations here.

function userComputed(data) {
  return {
    controlDeadlines: getControlDeadlines(data),
  };
}

exports.userComputed = userComputed;
