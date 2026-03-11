const path = require("path");
const express = require("express");
const session = require("express-session");
const db = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@fitness.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin123!";
const SESSION_SECRET = process.env.SESSION_SECRET || "fitness-app-secret";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  res.locals.isAdminAuthenticated = Boolean(req.session.admin);
  res.locals.adminEmail = req.session.admin ? req.session.admin.email : null;
  next();
});

function ensureAdmin(req, res, next) {
  if (req.session.admin) {
    next();
    return;
  }

  res.redirect("/admin/login");
}

function getLevels() {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM levels ORDER BY id ASC", (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

function getLevelById(levelId) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM levels WHERE id = ?", [levelId], (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

function getExercisesByLevel(levelId) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM exercises WHERE level_id = ? ORDER BY id ASC",
      [levelId],
      (error, rows) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(rows);
      }
    );
  });
}

app.get("/", async (req, res, next) => {
  try {
    const levels = await getLevels();
    res.render("home", { levels });
  } catch (error) {
    next(error);
  }
});

app.get("/admin/login", (req, res) => {
  if (req.session.admin) {
    res.redirect("/admin");
    return;
  }

  res.render("admin-login", {
    error: null,
    email: ""
  });
});

app.post("/admin/login", (req, res) => {
  const email = req.body.email ? req.body.email.trim() : "";
  const password = req.body.password ? req.body.password.trim() : "";

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    req.session.admin = { email };
    res.redirect("/admin");
    return;
  }

  res.status(401).render("admin-login", {
    error: "Invalid email or password.",
    email
  });
});

app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
});

app.get("/admin", ensureAdmin, async (req, res, next) => {
  try {
    const levels = await getLevels();
    res.render("admin", { levels, error: null });
  } catch (error) {
    next(error);
  }
});

app.post("/admin/levels", ensureAdmin, (req, res) => {
  const name = req.body.name ? req.body.name.trim() : "";

  if (!name) {
    db.all("SELECT * FROM levels ORDER BY id ASC", (error, rows) => {
      res.status(400).render("admin", {
        levels: error ? [] : rows,
        error: "Level name is required."
      });
    });
    return;
  }

  db.run("INSERT INTO levels (name) VALUES (?)", [name], (error) => {
    if (error) {
      res.status(500).send("Failed to create level.");
      return;
    }
    res.redirect("/admin");
  });
});

app.get("/admin/levels/:id", ensureAdmin, async (req, res, next) => {
  try {
    const levelId = Number(req.params.id);
    const [level, exercises] = await Promise.all([
      getLevelById(levelId),
      getExercisesByLevel(levelId)
    ]);

    if (!level) {
      res.status(404).send("Level not found.");
      return;
    }

    res.render("edit-level", { level, exercises, error: null });
  } catch (error) {
    next(error);
  }
});

app.post("/admin/levels/:id/exercises", ensureAdmin, async (req, res, next) => {
  const levelId = Number(req.params.id);
  const name = req.body.name ? req.body.name.trim() : "";
  const repsOrTime = req.body.reps_or_time ? req.body.reps_or_time.trim() : "";
  const sets = req.body.sets ? req.body.sets.trim() : "";
  const restTime = req.body.rest_time ? req.body.rest_time.trim() : "";

  if (!name || !repsOrTime || !sets || !restTime) {
    try {
      const [level, exercises] = await Promise.all([
        getLevelById(levelId),
        getExercisesByLevel(levelId)
      ]);

      res.status(400).render("edit-level", {
        level,
        exercises,
        error: "All exercise fields are required."
      });
    } catch (error) {
      next(error);
    }
    return;
  }

  db.run(
    `INSERT INTO exercises (level_id, name, reps_or_time, sets, rest_time)
     VALUES (?, ?, ?, ?, ?)`,
    [levelId, name, repsOrTime, sets, restTime],
    (error) => {
      if (error) {
        res.status(500).send("Failed to add exercise.");
        return;
      }
      res.redirect(`/admin/levels/${levelId}`);
    }
  );
});

app.post("/admin/exercises/:id/delete", ensureAdmin, (req, res) => {
  const exerciseId = Number(req.params.id);
  const levelId = Number(req.body.level_id);

  db.run("DELETE FROM exercises WHERE id = ?", [exerciseId], (error) => {
    if (error) {
      res.status(500).send("Failed to delete exercise.");
      return;
    }
    res.redirect(`/admin/levels/${levelId}`);
  });
});

app.get("/levels/:id", async (req, res, next) => {
  try {
    const levelId = Number(req.params.id);
    const [level, exercises] = await Promise.all([
      getLevelById(levelId),
      getExercisesByLevel(levelId)
    ]);

    if (!level) {
      res.status(404).send("Level not found.");
      return;
    }

    res.render("level", { level, exercises });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).send("Page not found.");
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).send("Internal server error.");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
