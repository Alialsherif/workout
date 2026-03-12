const levels = [];
const exercises = [];

let nextLevelId = 1;
let nextExerciseId = 1;

function asyncCallback(callback, error, result) {
  setImmediate(() => {
    callback(error, result);
  });
}

function sortByIdAsc(items) {
  return [...items].sort((first, second) => first.id - second.id);
}

const db = {
  all(query, params, callback) {
    const actualParams = Array.isArray(params) ? params : [];
    const actualCallback = typeof params === "function" ? params : callback;
    const normalizedQuery = query.trim().replace(/\s+/g, " ");

    if (normalizedQuery === "SELECT * FROM levels ORDER BY id ASC") {
      asyncCallback(actualCallback, null, sortByIdAsc(levels));
      return;
    }

    if (normalizedQuery === "SELECT * FROM exercises WHERE level_id = ? ORDER BY id ASC") {
      const levelId = Number(actualParams[0]);
      const rows = exercises.filter((exercise) => exercise.level_id === levelId);
      asyncCallback(actualCallback, null, sortByIdAsc(rows));
      return;
    }

    asyncCallback(actualCallback, new Error(`Unsupported query: ${query}`));
  },

  get(query, params, callback) {
    const normalizedQuery = query.trim().replace(/\s+/g, " ");

    if (normalizedQuery === "SELECT * FROM levels WHERE id = ?") {
      const levelId = Number(params[0]);
      const row = levels.find((level) => level.id === levelId) || undefined;
      asyncCallback(callback, null, row);
      return;
    }

    asyncCallback(callback, new Error(`Unsupported query: ${query}`));
  },

  run(query, params, callback) {
    const normalizedQuery = query.trim().replace(/\s+/g, " ");

    if (normalizedQuery === "INSERT INTO levels (name) VALUES (?)") {
      levels.push({
        id: nextLevelId++,
        name: params[0]
      });
      asyncCallback(callback, null);
      return;
    }

    if (
      normalizedQuery ===
      "INSERT INTO exercises (level_id, name, reps_or_time, sets, rest_time) VALUES (?, ?, ?, ?, ?)"
    ) {
      const levelId = Number(params[0]);
      const levelExists = levels.some((level) => level.id === levelId);

      if (!levelExists) {
        asyncCallback(callback, new Error("Level not found."));
        return;
      }

      exercises.push({
        id: nextExerciseId++,
        level_id: levelId,
        name: params[1],
        reps_or_time: params[2],
        sets: params[3],
        rest_time: params[4]
      });
      asyncCallback(callback, null);
      return;
    }

    if (normalizedQuery === "DELETE FROM exercises WHERE id = ?") {
      const exerciseId = Number(params[0]);
      const exerciseIndex = exercises.findIndex((exercise) => exercise.id === exerciseId);

      if (exerciseIndex !== -1) {
        exercises.splice(exerciseIndex, 1);
      }

      asyncCallback(callback, null);
      return;
    }

    if (
      normalizedQuery ===
      "UPDATE exercises SET name = ?, reps_or_time = ?, sets = ?, rest_time = ? WHERE id = ?"
    ) {
      const exerciseId = Number(params[4]);
      const exercise = exercises.find((item) => item.id === exerciseId);

      if (!exercise) {
        asyncCallback(callback, new Error("Exercise not found."));
        return;
      }

      exercise.name = params[0];
      exercise.reps_or_time = params[1];
      exercise.sets = params[2];
      exercise.rest_time = params[3];
      asyncCallback(callback, null);
      return;
    }

    if (normalizedQuery === "UPDATE levels SET name = ? WHERE id = ?") {
      const name = params[0];
      const levelId = Number(params[1]);
      const level = levels.find((item) => item.id === levelId);

      if (!level) {
        asyncCallback(callback, new Error("Level not found."));
        return;
      }

      level.name = name;
      asyncCallback(callback, null);
      return;
    }

    if (normalizedQuery === "DELETE FROM levels WHERE id = ?") {
      const levelId = Number(params[0]);
      const levelIndex = levels.findIndex((level) => level.id === levelId);

      if (levelIndex !== -1) {
        levels.splice(levelIndex, 1);
      }

      for (let index = exercises.length - 1; index >= 0; index -= 1) {
        if (exercises[index].level_id === levelId) {
          exercises.splice(index, 1);
        }
      }

      asyncCallback(callback, null);
      return;
    }

    asyncCallback(callback, new Error(`Unsupported query: ${query}`));
  }
};

module.exports = db;
