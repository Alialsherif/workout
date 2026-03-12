const fs = require("fs");
const path = require("path");
const session = require("express-session");

const dataDirectory = path.join(__dirname, "..", "data");
const sessionsFilePath = path.join(dataDirectory, "sessions.json");

function ensureSessionsFile() {
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
  }

  if (!fs.existsSync(sessionsFilePath)) {
    fs.writeFileSync(sessionsFilePath, "{}", "utf8");
  }
}

function loadSessions() {
  ensureSessionsFile();

  try {
    const fileContents = fs.readFileSync(sessionsFilePath, "utf8");
    const parsed = JSON.parse(fileContents);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    fs.writeFileSync(sessionsFilePath, "{}", "utf8");
    return {};
  }
}

function saveSessions(sessions) {
  ensureSessionsFile();
  const temporaryFilePath = `${sessionsFilePath}.tmp`;

  fs.writeFileSync(temporaryFilePath, JSON.stringify(sessions, null, 2), "utf8");
  fs.renameSync(temporaryFilePath, sessionsFilePath);
}

class FileSessionStore extends session.Store {
  constructor() {
    super();
    this.sessions = loadSessions();
    this.clearExpiredSessions();
  }

  clearExpiredSessions() {
    const now = Date.now();
    let hasChanges = false;

    for (const [sid, serializedSession] of Object.entries(this.sessions)) {
      try {
        const parsedSession = JSON.parse(serializedSession);
        const expiresAt = parsedSession.cookie && parsedSession.cookie.expires
          ? new Date(parsedSession.cookie.expires).getTime()
          : null;

        if (expiresAt && expiresAt <= now) {
          delete this.sessions[sid];
          hasChanges = true;
        }
      } catch (error) {
        delete this.sessions[sid];
        hasChanges = true;
      }
    }

    if (hasChanges) {
      saveSessions(this.sessions);
    }
  }

  get(sid, callback) {
    this.clearExpiredSessions();
    const serializedSession = this.sessions[sid];

    if (!serializedSession) {
      callback(null, null);
      return;
    }

    try {
      callback(null, JSON.parse(serializedSession));
    } catch (error) {
      delete this.sessions[sid];
      saveSessions(this.sessions);
      callback(null, null);
    }
  }

  set(sid, sessionData, callback) {
    this.sessions[sid] = JSON.stringify(sessionData);
    saveSessions(this.sessions);
    callback && callback(null);
  }

  destroy(sid, callback) {
    delete this.sessions[sid];
    saveSessions(this.sessions);
    callback && callback(null);
  }

  touch(sid, sessionData, callback) {
    this.sessions[sid] = JSON.stringify(sessionData);
    saveSessions(this.sessions);
    callback && callback(null);
  }
}

module.exports = FileSessionStore;
