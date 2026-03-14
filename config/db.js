const fs = require("fs");
const path = require("path");

const dataDirectory = path.join(__dirname, "..", "data");
const dataFilePath = path.join(dataDirectory, "workout-data.json");

function createDefaultState() {
  return {
    levels: [],
    exercises: [],
    progress: {},
    nextLevelId: 1,
    nextExerciseId: 1
  };
}

function ensureDataFile() {
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
  }

  if (!fs.existsSync(dataFilePath)) {
    fs.writeFileSync(dataFilePath, JSON.stringify(createDefaultState(), null, 2), "utf8");
  }
}

function loadState() {
  ensureDataFile();

  try {
    const fileContents = fs.readFileSync(dataFilePath, "utf8");
    const parsed = JSON.parse(fileContents);

    return {
      levels: Array.isArray(parsed.levels) ? parsed.levels : [],
      exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
      progress: parsed.progress && typeof parsed.progress === "object" ? parsed.progress : {},
      nextLevelId: Number.isInteger(parsed.nextLevelId) ? parsed.nextLevelId : 1,
      nextExerciseId: Number.isInteger(parsed.nextExerciseId) ? parsed.nextExerciseId : 1
    };
  } catch (error) {
    const fallbackState = createDefaultState();
    fs.writeFileSync(dataFilePath, JSON.stringify(fallbackState, null, 2), "utf8");
    return fallbackState;
  }
}

let state = loadState();

function persistState() {
  ensureDataFile();
  const temporaryFilePath = `${dataFilePath}.tmp`;

  fs.writeFileSync(temporaryFilePath, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(temporaryFilePath, dataFilePath);
}

function asyncCallback(callback, error, result) {
  setImmediate(() => {
    callback(error, result);
  });
}

function sortByIdAsc(items) {
  return [...items].sort((first, second) => first.id - second.id);
}

function normalizeProgressIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)
  )].sort((first, second) => first - second);
}

const db = {
  exportData() {
    return JSON.parse(JSON.stringify(state));
  },

  getLevelProgress(sessionId, levelId) {
    const normalizedLevelId = String(Number(levelId));

    if (!sessionId || normalizedLevelId === "NaN") {
      return [];
    }

    const sessionProgress = state.progress[sessionId];
    return normalizeProgressIds(sessionProgress ? sessionProgress[normalizedLevelId] : []);
  },

  saveLevelProgress(sessionId, levelId, completedExerciseIds) {
    const normalizedLevelId = String(Number(levelId));

    if (!sessionId || normalizedLevelId === "NaN") {
      return;
    }

    if (!state.progress[sessionId]) {
      state.progress[sessionId] = {};
    }

    state.progress[sessionId][normalizedLevelId] = normalizeProgressIds(completedExerciseIds);
    persistState();
  },

  all(query, params, callback) {
    const actualParams = Array.isArray(params) ? params : [];
    const actualCallback = typeof params === "function" ? params : callback;
    const normalizedQuery = query.trim().replace(/\s+/g, " ");

    if (normalizedQuery === "SELECT * FROM levels ORDER BY id ASC") {
      asyncCallback(actualCallback, null, sortByIdAsc(state.levels));
      return;
    }

    if (normalizedQuery === "SELECT * FROM exercises WHERE level_id = ? ORDER BY id ASC") {
      const levelId = Number(actualParams[0]);
      const rows = state.exercises.filter((exercise) => exercise.level_id === levelId);
      asyncCallback(actualCallback, null, sortByIdAsc(rows));
      return;
    }

    asyncCallback(actualCallback, new Error(`Unsupported query: ${query}`));
  },

  get(query, params, callback) {
    const normalizedQuery = query.trim().replace(/\s+/g, " ");

    if (normalizedQuery === "SELECT * FROM levels WHERE id = ?") {
      const levelId = Number(params[0]);
      const row = state.levels.find((level) => level.id === levelId) || undefined;
      asyncCallback(callback, null, row);
      return;
    }

    asyncCallback(callback, new Error(`Unsupported query: ${query}`));
  },

  run(query, params, callback) {
    const normalizedQuery = query.trim().replace(/\s+/g, " ");

    if (normalizedQuery === "INSERT INTO levels (name) VALUES (?)") {
      state.levels.push({
        id: state.nextLevelId++,
        name: params[0]
      });
      persistState();
      asyncCallback(callback, null);
      return;
    }

    if (
      normalizedQuery ===
      "INSERT INTO exercises (level_id, name, reps_or_time, sets, rest_time) VALUES (?, ?, ?, ?, ?)"
    ) {
      const levelId = Number(params[0]);
      const levelExists = state.levels.some((level) => level.id === levelId);

      if (!levelExists) {
        asyncCallback(callback, new Error("Level not found."));
        return;
      }

      state.exercises.push({
        id: state.nextExerciseId++,
        level_id: levelId,
        name: params[1],
        reps_or_time: params[2],
        sets: params[3],
        rest_time: params[4]
      });
      persistState();
      asyncCallback(callback, null);
      return;
    }

    if (normalizedQuery === "DELETE FROM exercises WHERE id = ?") {
      const exerciseId = Number(params[0]);
      const exerciseIndex = state.exercises.findIndex((exercise) => exercise.id === exerciseId);

      if (exerciseIndex !== -1) {
        state.exercises.splice(exerciseIndex, 1);

        for (const sessionProgress of Object.values(state.progress)) {
          if (!sessionProgress || typeof sessionProgress !== "object") {
            continue;
          }

          for (const levelId of Object.keys(sessionProgress)) {
            sessionProgress[levelId] = normalizeProgressIds(sessionProgress[levelId]).filter(
              (id) => id !== exerciseId
            );
          }
        }

        persistState();
      }

      asyncCallback(callback, null);
      return;
    }

    if (
      normalizedQuery ===
      "UPDATE exercises SET name = ?, reps_or_time = ?, sets = ?, rest_time = ? WHERE id = ?"
    ) {
      const exerciseId = Number(params[4]);
      const exercise = state.exercises.find((item) => item.id === exerciseId);

      if (!exercise) {
        asyncCallback(callback, new Error("Exercise not found."));
        return;
      }

      exercise.name = params[0];
      exercise.reps_or_time = params[1];
      exercise.sets = params[2];
      exercise.rest_time = params[3];
      persistState();
      asyncCallback(callback, null);
      return;
    }

    if (normalizedQuery === "UPDATE levels SET name = ? WHERE id = ?") {
      const name = params[0];
      const levelId = Number(params[1]);
      const level = state.levels.find((item) => item.id === levelId);

      if (!level) {
        asyncCallback(callback, new Error("Level not found."));
        return;
      }

      level.name = name;
      persistState();
      asyncCallback(callback, null);
      return;
    }

    if (normalizedQuery === "DELETE FROM levels WHERE id = ?") {
      const levelId = Number(params[0]);
      const levelIndex = state.levels.findIndex((level) => level.id === levelId);

      if (levelIndex !== -1) {
        state.levels.splice(levelIndex, 1);
      }

      for (let index = state.exercises.length - 1; index >= 0; index -= 1) {
        if (state.exercises[index].level_id === levelId) {
          state.exercises.splice(index, 1);
        }
      }

      for (const sessionProgress of Object.values(state.progress)) {
        if (!sessionProgress || typeof sessionProgress !== "object") {
          continue;
        }

        delete sessionProgress[String(levelId)];
      }

      persistState();
      asyncCallback(callback, null);
      return;
    }

    asyncCallback(callback, new Error(`Unsupported query: ${query}`));
  }
};

module.exports = db;
