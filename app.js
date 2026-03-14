const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const db = require("./config/db");
const FileSessionStore = require("./config/session-store");

function loadEnvFile() {
  const envFilePath = path.join(__dirname, ".env");

  if (!fs.existsSync(envFilePath)) {
    return;
  }

  const envLines = fs.readFileSync(envFilePath, "utf8").split(/\r?\n/);

  for (const line of envLines) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const normalizedValue = rawValue.replace(/^['\"]|['\"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = normalizedValue;
    }
  }
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function isSecureEqual(firstValue, secondValue) {
  const firstBuffer = Buffer.from(firstValue, "hex");
  const secondBuffer = Buffer.from(secondValue, "hex");

  if (firstBuffer.length !== secondBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getPersistentSessionSecret() {
  const secretFilePath = path.join(__dirname, "data", "session-secret.txt");

  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }

  if (!fs.existsSync(path.dirname(secretFilePath))) {
    fs.mkdirSync(path.dirname(secretFilePath), { recursive: true });
  }

  if (!fs.existsSync(secretFilePath)) {
    fs.writeFileSync(secretFilePath, crypto.randomBytes(32).toString("hex"), "utf8");
  }

  return fs.readFileSync(secretFilePath, "utf8").trim();
}

loadEnvFile();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = normalizeEmail(process.env.ADMIN_EMAIL);
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";
const ADMIN_PASSWORD_SALT = process.env.ADMIN_PASSWORD_SALT || "";
const SESSION_SECRET = getPersistentSessionSecret();
const DEFAULT_LANG = "ar";
const isAdminAuthConfigured = Boolean(
  ADMIN_EMAIL && ADMIN_PASSWORD_HASH && ADMIN_PASSWORD_SALT
);

if (!isAdminAuthConfigured) {
  console.warn(
    "Admin authentication is not fully configured. Set ADMIN_EMAIL, ADMIN_PASSWORD_HASH, and ADMIN_PASSWORD_SALT in .env."
  );
}

const translations = {
  ar: {
    siteTitle: "نظام التمارين",
    footerMarketing: "هذا موقع بسيط جدًا ومصمم حسب الطلب، مناسب لعرض الفكرة بشكل واضح وعملي بدون تعقيد.",
    contactWhatsApp: "تواصل مع المبرمج عبر واتساب",
    openAdminDashboard: "الذهاب إلى لوحة الإدارة",
    openAdminPanel: "دخول لوحة الإدارة",
    chooseTrainingLevel: "اختر مستوى التمرين المناسب لك",
    homeIntro:
      "تصفح الخطط المتاحة، وافتح المستوى الذي يناسبك لتبدأ التمرين بخطوات واضحة وسهلة من الهاتف أو الكمبيوتر.",
    mobileOptimized: "واجهة محسنة للهاتف",
    autoArabicSupport: "دعم عربي تلقائي",
    availableLevels: "المستويات المتاحة",
    levelCount: "مستوى",
    noLevels: "لا توجد مستويات مضافة حتى الآن.",
    addFirstLevel: "أضف أول مستوى",
    levelLabel: "المستوى",
    levelCardCopy: "افتح هذا المستوى لمراجعة التمارين وتتبع ما أنجزته بسهولة.",
    trainingLevel: "مستوى التدريب",
    levelIntro: "نفذ كل تمرين بالترتيب، ثم ضع علامة عند الإكمال لتتبع تقدمك بسهولة.",
    backHome: "العودة للرئيسية",
    workoutPlan: "خطة التمرين",
    exerciseCount: "تمرين",
    noExercises: "لا توجد تمارين مضافة لهذا المستوى حاليًا.",
    exerciseName: "التمرين",
    repsOrTime: "العدد أو الوقت",
    sets: "الجولات",
    restTime: "الراحة",
    done: "تم",
    complete: "إكمال",
    pendingExercises: "تمارين قيد التنفيذ",
    completedExercises: "تمارين تم إنجازها",
    noCompletedExercises: "لا توجد تمارين مكتملة بعد.",
    adminPanel: "لوحة الإدارة",
    manageWorkoutLevels: "إدارة مستويات التمارين",
    adminIntro: "أضف المستويات، وادخل لكل مستوى لإدارة التمارين بشكل واضح وسريع من الهاتف.",
    logout: "تسجيل الخروج",
    addNewLevel: "إضافة مستوى جديد",
    levelName: "اسم المستوى",
    levelPlaceholder: "مبتدئ أو Beginner",
    addLevel: "إضافة المستوى",
    allLevels: "كل المستويات",
    total: "إجمالي",
    noLevelsCreated: "لم يتم إنشاء أي مستوى بعد.",
    view: "عرض",
    manageExercises: "إدارة التمارين",
    editLevel: "تعديل المستوى",
    manageExercisesTitle: "إدارة التمارين",
    editLevelIntro: "أضف تمارين هذا المستوى ليشاهدها المستخدمون بشكل مرتب في صفحة العرض.",
    backAdmin: "العودة للإدارة",
    openUserView: "فتح صفحة المستخدم",
    addExercise: "إضافة تمرين",
    exercisePlaceholder: "Push Ups أو ضغط",
    repsPlaceholder: "15 عدة أو 45 ثانية",
    setsPlaceholder: "3",
    restPlaceholder: "30 ثانية",
    addExerciseButton: "إضافة التمرين",
    exercises: "التمارين",
    itemCount: "عنصر",
    noLevelExercises: "لا توجد تمارين مضافة لهذا المستوى بعد.",
    action: "الإجراء",
    edit: "تعديل",
    delete: "حذف",
    deleteLevel: "حذف المستوى",
    saveChanges: "حفظ التعديلات",
    levelUpdated: "تم تحديث اسم المستوى.",
    levelDeleted: "تم حذف المستوى.",
    exerciseUpdated: "تم تحديث التمرين.",
    adminAccess: "دخول الإدارة",
    adminLoginTitle: "تسجيل الدخول إلى لوحة الإدارة",
    adminLoginIntro: "بعد تسجيل الدخول سيتم حفظ الجلسة تلقائيًا لتتمكن من إدارة المحتوى بسهولة.",
    loginDetails: "بيانات الدخول",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    passwordPlaceholder: "أدخل كلمة المرور",
    login: "دخول",
    langArabic: "العربية",
    langEnglish: "English",
    invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    levelNameRequired: "اسم المستوى مطلوب.",
    createLevelFailed: "تعذر إنشاء المستوى.",
    updateLevelFailed: "تعذر تحديث المستوى.",
    deleteLevelFailed: "تعذر حذف المستوى.",
    levelNotFound: "المستوى غير موجود.",
    exerciseFieldsRequired: "كل حقول التمرين مطلوبة.",
    addExerciseFailed: "تعذر إضافة التمرين.",
    updateExerciseFailed: "تعذر تحديث التمرين.",
    deleteExerciseFailed: "تعذر حذف التمرين.",
    exerciseNotFound: "التمرين غير موجود.",
    pageNotFound: "الصفحة غير موجودة.",
    internalServerError: "حدث خطأ داخلي في الخادم."
  },
  en: {
    siteTitle: "Workout Training System",
    footerMarketing: "This is a very simple website built exactly as requested, focused on clarity and practical use rather than complexity.",
    contactWhatsApp: "Contact on WhatsApp with Developer",
    openAdminDashboard: "Open Admin Dashboard",
    openAdminPanel: "Open Admin Panel",
    chooseTrainingLevel: "Choose Your Training Level",
    homeIntro:
      "Browse the available plans and open the level that fits you to start your workout clearly on mobile or desktop.",
    mobileOptimized: "Mobile-optimized UI",
    autoArabicSupport: "Better Arabic text support",
    availableLevels: "Available Levels",
    levelCount: "levels",
    noLevels: "No levels have been added yet.",
    addFirstLevel: "Add the first level",
    levelLabel: "Level",
    levelCardCopy: "Open this level to review exercises and track your progress easily.",
    trainingLevel: "Training Level",
    levelIntro: "Complete each exercise in order, then tick it off to track your progress easily.",
    backHome: "Back to Home",
    workoutPlan: "Workout Plan",
    exerciseCount: "exercises",
    noExercises: "No exercises have been added for this level yet.",
    exerciseName: "Exercise",
    repsOrTime: "Reps or Time",
    sets: "Sets",
    restTime: "Rest",
    done: "Done",
    complete: "Complete",
    pendingExercises: "Exercises In Progress",
    completedExercises: "Completed Exercises",
    noCompletedExercises: "No completed exercises yet.",
    adminPanel: "Admin Panel",
    manageWorkoutLevels: "Manage Workout Levels",
    adminIntro: "Add levels and open each one to manage exercises quickly with a cleaner mobile experience.",
    logout: "Logout",
    addNewLevel: "Add New Level",
    levelName: "Level Name",
    levelPlaceholder: "Beginner or مبتدئ",
    addLevel: "Add Level",
    allLevels: "All Levels",
    total: "total",
    noLevelsCreated: "No levels have been created yet.",
    view: "View",
    manageExercises: "Manage Exercises",
    editLevel: "Edit Level",
    manageExercisesTitle: "Manage Exercises",
    editLevelIntro: "Add exercises for this level so users can see them in a clean workout page.",
    backAdmin: "Back to Admin",
    openUserView: "Open User View",
    addExercise: "Add Exercise",
    exercisePlaceholder: "Push Ups or ضغط",
    repsPlaceholder: "15 reps or 45 sec",
    setsPlaceholder: "3",
    restPlaceholder: "30 sec",
    addExerciseButton: "Add Exercise",
    exercises: "Exercises",
    itemCount: "items",
    noLevelExercises: "No exercises have been added for this level yet.",
    action: "Action",
    edit: "Edit",
    delete: "Delete",
    deleteLevel: "Delete Level",
    saveChanges: "Save Changes",
    levelUpdated: "Level name updated.",
    levelDeleted: "Level deleted.",
    exerciseUpdated: "Exercise updated.",
    adminAccess: "Admin Access",
    adminLoginTitle: "Sign in to the Admin Panel",
    adminLoginIntro: "After login, a session will be saved so you can manage the content easily.",
    loginDetails: "Login Details",
    email: "Email",
    password: "Password",
    passwordPlaceholder: "Enter your password",
    login: "Login",
    langArabic: "العربية",
    langEnglish: "English",
    invalidCredentials: "Invalid email or password.",
    levelNameRequired: "Level name is required.",
    createLevelFailed: "Failed to create level.",
    updateLevelFailed: "Failed to update level.",
    deleteLevelFailed: "Failed to delete level.",
    levelNotFound: "Level not found.",
    exerciseFieldsRequired: "All exercise fields are required.",
    addExerciseFailed: "Failed to add exercise.",
    updateExerciseFailed: "Failed to update exercise.",
    deleteExerciseFailed: "Failed to delete exercise.",
    exerciseNotFound: "Exercise not found.",
    pageNotFound: "Page not found.",
    internalServerError: "Internal server error."
  }
};

function getLanguage(lang) {
  return lang === "en" ? "en" : DEFAULT_LANG;
}

function t(lang, key) {
  const language = getLanguage(lang);
  return translations[language][key] || translations[DEFAULT_LANG][key] || key;
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: SESSION_SECRET,
    store: new FileSessionStore(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);
app.use(express.static(path.join(__dirname, "public")));

app.get("/language/:lang", (req, res) => {
  req.session.lang = getLanguage(req.params.lang);
  const returnTo = typeof req.query.returnTo === "string" && req.query.returnTo.startsWith("/")
    ? req.query.returnTo
    : "/";
  res.redirect(returnTo);
});

app.use((req, res, next) => {
  const lang = getLanguage(req.session.lang);
  res.locals.lang = lang;
  res.locals.dir = lang === "ar" ? "rtl" : "ltr";
  res.locals.t = translations[lang];
  res.locals.isAdminAuthenticated = Boolean(req.session.admin);
  res.locals.adminEmail = req.session.admin ? req.session.admin.email : null;
  res.locals.switchToArabicHref = `/language/ar?returnTo=${encodeURIComponent(req.originalUrl)}`;
  res.locals.switchToEnglishHref = `/language/en?returnTo=${encodeURIComponent(req.originalUrl)}`;
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

async function getLevelsWithExercises() {
  const levels = await getLevels();
  const levelsWithExercises = await Promise.all(
    levels.map(async (level) => ({
      ...level,
      exercises: await getExercisesByLevel(level.id)
    }))
  );

  return levelsWithExercises;
}

function updateLevel(levelId, name) {
  return new Promise((resolve, reject) => {
    db.run("UPDATE levels SET name = ? WHERE id = ?", [name, levelId], (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function deleteLevel(levelId) {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM levels WHERE id = ?", [levelId], (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function updateExercise(exerciseId, payload) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE exercises SET name = ?, reps_or_time = ?, sets = ?, rest_time = ? WHERE id = ?",
      [payload.name, payload.repsOrTime, payload.sets, payload.restTime, exerciseId],
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      }
    );
  });
}

function adminLevelAnchor(levelId) {
  return `/admin#level-${levelId}`;
}

function normalizeCompletedExerciseIds(exercises, completedExerciseIds) {
  const validExerciseIds = new Set(exercises.map((exercise) => exercise.id));

  return [...new Set(
    (Array.isArray(completedExerciseIds) ? completedExerciseIds : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && validExerciseIds.has(value))
  )].sort((first, second) => first - second);
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
  const normalizedEmail = normalizeEmail(email);
  const hashedPassword = isAdminAuthConfigured
    ? hashPassword(password, ADMIN_PASSWORD_SALT)
    : "";
  const isValidLogin =
    isAdminAuthConfigured &&
    normalizedEmail === ADMIN_EMAIL &&
    isSecureEqual(hashedPassword, ADMIN_PASSWORD_HASH);

  if (isValidLogin) {
    req.session.admin = { email };
    res.redirect("/admin");
    return;
  }

  res.status(401).render("admin-login", {
    error: t(req.session.lang, "invalidCredentials"),
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
    const levels = await getLevelsWithExercises();
    res.render("admin", { levels, error: null, success: null });
  } catch (error) {
    next(error);
  }
});

app.post("/admin/levels", ensureAdmin, (req, res, next) => {
  const name = req.body.name ? req.body.name.trim() : "";

  if (!name) {
    getLevelsWithExercises()
      .then((levels) => {
        res.status(400).render("admin", {
          levels,
          error: t(req.session.lang, "levelNameRequired"),
          success: null
        });
      })
      .catch(next);
    return;
  }

  db.run("INSERT INTO levels (name) VALUES (?)", [name], (error) => {
    if (error) {
      res.status(500).send(t(req.session.lang, "createLevelFailed"));
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
      res.redirect("/admin");
      return;
    }

    res.render("edit-level", { level, exercises, error: null, success: null });
  } catch (error) {
    next(error);
  }
});

app.post("/admin/levels/:id/edit", ensureAdmin, async (req, res, next) => {
  const levelId = Number(req.params.id);
  const name = req.body.name ? req.body.name.trim() : "";

  if (!name) {
    try {
      const levels = await getLevelsWithExercises();
      const level = levels.find((item) => item.id === levelId);

      if (!level) {
        res.status(404).send(t(req.session.lang, "levelNotFound"));
        return;
      }

      res.status(400).render("admin", {
        levels,
        error: t(req.session.lang, "levelNameRequired"),
        success: null
      });
    } catch (error) {
      next(error);
    }
    return;
  }

  try {
    await updateLevel(levelId, name);
    const levels = await getLevelsWithExercises();

    res.render("admin", {
      levels,
      error: null,
      success: t(req.session.lang, "levelUpdated")
    });
  } catch (error) {
    if (error.message === "Level not found.") {
      res.status(404).send(t(req.session.lang, "levelNotFound"));
      return;
    }

    res.status(500).send(t(req.session.lang, "updateLevelFailed"));
  }
});

app.post("/admin/levels/:id/delete", ensureAdmin, async (req, res) => {
  const levelId = Number(req.params.id);

  try {
    await deleteLevel(levelId);
    res.redirect("/admin");
  } catch (error) {
    res.status(500).send(t(req.session.lang, "deleteLevelFailed"));
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
      const levels = await getLevelsWithExercises();
      res.status(400).render("admin", {
        levels,
        error: t(req.session.lang, "exerciseFieldsRequired"),
        success: null
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
        res.status(500).send(t(req.session.lang, "addExerciseFailed"));
        return;
      }
      res.redirect(adminLevelAnchor(levelId));
    }
  );
});

app.post("/admin/exercises/:id/edit", ensureAdmin, async (req, res, next) => {
  const exerciseId = Number(req.params.id);
  const levelId = Number(req.body.level_id);
  const name = req.body.name ? req.body.name.trim() : "";
  const repsOrTime = req.body.reps_or_time ? req.body.reps_or_time.trim() : "";
  const sets = req.body.sets ? req.body.sets.trim() : "";
  const restTime = req.body.rest_time ? req.body.rest_time.trim() : "";

  if (!name || !repsOrTime || !sets || !restTime) {
    try {
      const levels = await getLevelsWithExercises();
      const level = levels.find((item) => item.id === levelId);

      if (!level) {
        res.status(404).send(t(req.session.lang, "levelNotFound"));
        return;
      }

      res.status(400).render("admin", {
        levels,
        error: t(req.session.lang, "exerciseFieldsRequired"),
        success: null
      });
    } catch (error) {
      next(error);
    }
    return;
  }

  try {
    await updateExercise(exerciseId, {
      name,
      repsOrTime,
      sets,
      restTime
    });

    const levels = await getLevelsWithExercises();
    const level = levels.find((item) => item.id === levelId);

    if (!level) {
      res.status(404).send(t(req.session.lang, "levelNotFound"));
      return;
    }

    res.render("admin", {
      levels,
      error: null,
      success: t(req.session.lang, "exerciseUpdated")
    });
  } catch (error) {
    if (error.message === "Exercise not found.") {
      res.status(404).send(t(req.session.lang, "exerciseNotFound"));
      return;
    }

    res.status(500).send(t(req.session.lang, "updateExerciseFailed"));
  }
});

app.post("/admin/exercises/:id/delete", ensureAdmin, (req, res) => {
  const exerciseId = Number(req.params.id);
  const levelId = Number(req.body.level_id);

  db.run("DELETE FROM exercises WHERE id = ?", [exerciseId], (error) => {
    if (error) {
      res.status(500).send(t(req.session.lang, "deleteExerciseFailed"));
      return;
    }
    res.redirect(adminLevelAnchor(levelId));
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
      res.redirect("/");
      return;
    }

    if (!req.session.progressTracker) {
      req.session.progressTracker = true;
    }

    res.render("level", { level, exercises });
  } catch (error) {
    next(error);
  }
});

app.get("/api/levels/:id/progress", async (req, res, next) => {
  try {
    const levelId = Number(req.params.id);
    const [level, exercises] = await Promise.all([
      getLevelById(levelId),
      getExercisesByLevel(levelId)
    ]);

    if (!level) {
      res.status(404).json({ error: "Level not found." });
      return;
    }

    const completedExerciseIds = normalizeCompletedExerciseIds(
      exercises,
      db.getLevelProgress(req.sessionID, levelId)
    );

    res.json({ completedExerciseIds });
  } catch (error) {
    next(error);
  }
});

app.post("/api/levels/:id/progress", express.json(), async (req, res, next) => {
  try {
    const levelId = Number(req.params.id);
    const [level, exercises] = await Promise.all([
      getLevelById(levelId),
      getExercisesByLevel(levelId)
    ]);

    if (!level) {
      res.status(404).json({ error: "Level not found." });
      return;
    }

    if (!req.session.progressTracker) {
      req.session.progressTracker = true;
    }

    const completedExerciseIds = normalizeCompletedExerciseIds(
      exercises,
      req.body ? req.body.completedExerciseIds : []
    );

    db.saveLevelProgress(req.sessionID, levelId, completedExerciseIds);
    res.json({ completedExerciseIds });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).send(t(req.session.lang, "pageNotFound"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).send(t(req.session.lang, "internalServerError"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


