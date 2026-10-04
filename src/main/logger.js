const fs = require("node:fs");
const path = require("node:path");

function serializeDetails(details) {
  if (details instanceof Error) {
    return details.stack || `${details.name}: ${details.message}`;
  }

  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

function createLogger(getUserDataPath) {
  function write(level, message, details) {
    try {
      const logDirectory = path.join(getUserDataPath(), "logs");
      const logFile = path.join(logDirectory, "app.log");
      const detailText = details === undefined ? "" : ` ${serializeDetails(details)}`;
      const line = `${new Date().toISOString()} [${level}] ${message}${detailText}\n`;

      fs.mkdirSync(logDirectory, { recursive: true });
      fs.appendFileSync(logFile, line, "utf8");
    } catch {
      // Logging errors must not interrupt app startup or shutdown.
    }
  }

  return {
    logInfo(message, details) {
      write("INFO", message, details);
    },
    logError(message, error) {
      write("ERROR", message, error);
    },
    getLogPath() {
      try {
        return path.join(getUserDataPath(), "logs", "app.log");
      } catch {
        return null;
      }
    },
  };
}

module.exports = { createLogger };
