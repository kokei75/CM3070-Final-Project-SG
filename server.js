//import required modules
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = 3000;

console.log("RUNNING FROM:", __filename);

//database connection
const db = new sqlite3.Database(
  path.join(__dirname, "database", "app.db")
);

//read sql setup file
const initSql = fs.readFileSync(
  path.join(__dirname, "database", "init.sql"),
  "utf8"
);

//run database setup
db.exec(initSql, (err) => {
  if (err) {
    console.error("DB init error:", err.message);
  } else {
    console.log("Database initialised");
  }
});

//parse form data
app.use(express.urlencoded({ extended: true }));

//parse json data
app.use(express.json());

//serve public files
app.use(express.static(path.join(__dirname, "public")));

//serve css files
app.use("/styles", express.static(path.join(__dirname, "styles")));

//session setup
app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: path.join(__dirname, "database"),
    }),
    secret: "change-this-to-a-long-random-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60,
    },
  })
);

//limit repeated login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts. Please try again later.",
});

//check if logged in as resident
function requireResident(req, res, next) {
  if (req.session.user && req.session.user.role === "resident") {
    return next();
  }
  return res.redirect("/residentLogin.html");
}

//check if logged in as authority
function requireAuthority(req, res, next) {
  if (req.session.user && req.session.user.role === "authority") {
    return next();
  }
  return res.redirect("/index.html");
}

//check username format
function validateUsername(username) {
  const validUsername = /^[a-zA-Z0-9_]{3,20}$/;
  return validUsername.test(username);
}

//check password strength
function validatePassword(password) {
  const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return strongPassword.test(password);
}

//store latest reading from each node
let latest = {
  water: {
    cm: null,
    status: "NO_DATA",
    seq: 0,
    rssi: null,
    lastSeen: null
  },
  city: {
    tempC: null,
    humidity: null,
    rainRaw: null,
    rainPercent: null,
    pressurehPa: null,
    altitudeM: null,
    status: "NO_DATA",
    seq: 0,
    rssi: null,
    lastSeen: null
  },
  wall: {
    state: "NO_DATA",
    triggeredBy: "NO_DATA",
    seq: 0,
    rssi: null,
    snr: null,
    lastSeen: null
  }
};

//maximum history rows to keep
const MAX_HISTORY = 200;

//store past readings for each node
let history = {
  water: [],
  city: [],
  wall: []
};

//add a new reading to history
function pushHistory(type, entry) {
  history[type].unshift(entry);

  //trim history if too long
  if (history[type].length > MAX_HISTORY) {
    history[type] = history[type].slice(0, MAX_HISTORY);
  }
}

//return latest sensor data
app.get("/api/latest", (req, res) => {
  res.json(latest);
});

//return sensor history for authority
app.get("/api/history", requireAuthority, (req, res) => {
  res.json(history);
});

//resident login
app.post("/login/resident", loginLimiter, (req, res) => {
  const username = req.body.username?.trim();
  const password = req.body.password?.trim();

  //check required fields
  if (!username || !password) {
    return res.status(400).send("Missing fields");
  }

  //find resident account
  db.get(
    "SELECT * FROM residents WHERE username = ?",
    [username],
    async (err, user) => {
      if (err) {
        console.error(err.message);
        return res.status(500).send("Server error");
      }

      //invalid username
      if (!user) {
        return res.status(401).send("Invalid login");
      }

      try {
        //compare password with hashed password
        const match = await bcrypt.compare(password, user.password);

        //invalid password
        if (!match) {
          return res.status(401).send("Invalid login");
        }

        //save resident session
        req.session.user = {
          id: user.id,
          username: user.username,
          role: "resident",
          name: user.name
        };

        return res.redirect("/resident");
      } catch (error) {
        console.error(error);
        return res.status(500).send("Server error");
      }
    }
  );
});

//authority login
app.post("/login/authority", loginLimiter, (req, res) => {
  const username = req.body.username?.trim();
  const password = req.body.password?.trim();

  //check required fields
  if (!username || !password) {
    return res.status(400).send("Missing fields");
  }

  //find authority account
  db.get(
    "SELECT * FROM authorities WHERE username = ?",
    [username],
    async (err, user) => {
      if (err) {
        console.error(err.message);
        return res.status(500).send("Server error");
      }

      //invalid username
      if (!user) {
        return res.status(401).send("Invalid login");
      }

      try {
        //compare password with hashed password
        const match = await bcrypt.compare(password, user.password);

        //invalid password
        if (!match) {
          return res.status(401).send("Invalid login");
        }

        //save authority session
        req.session.user = {
          id: user.id,
          username: user.username,
          role: "authority",
          name: user.name
        };

        return res.redirect("/authority");
      } catch (error) {
        console.error(error);
        return res.status(500).send("Server error");
      }
    }
  );
});

//resident signup
app.post("/signup/resident", async (req, res) => {
  const name = req.body.name?.trim();
  const username = req.body.username?.trim();
  const password = req.body.password?.trim();

  //check required fields
  if (!name || !username || !password) {
    return res.status(400).send("Missing fields");
  }

  //validate username
  if (!validateUsername(username)) {
    return res
      .status(400)
      .send("Username must be 3-20 characters and contain only letters, numbers, or underscores");
  }

  //validate password
  if (!validatePassword(password)) {
    return res
      .status(400)
      .send("Password must be at least 8 characters and include uppercase, lowercase, and a number");
  }

  try {
    //hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    //insert new resident
    db.run(
      "INSERT INTO residents (name, username, password) VALUES (?, ?, ?)",
      [name, username, hashedPassword],
      (err) => {
        if (err) {
          //username already exists
          if (err.message.includes("UNIQUE")) {
            return res.status(400).send("Username already exists");
          }

          console.error(err.message);
          return res.status(500).send("Server error");
        }

        return res.redirect("/residentLogin.html");
      }
    );
  } catch (error) {
    console.error(error);
    return res.status(500).send("Server error");
  }
});

//receive data from iot nodes
app.post("/api/ingest", (req, res) => {
  console.log("INGEST HIT", new Date().toISOString(), req.body?.node);
  console.log(req.body);

  const b = req.body;
  const now = Date.now();

  //water node update
  if (b.node === "WATER") {
    latest.water = {
      cm: typeof b.cm === "number" ? b.cm : null,
      status: b.status || "NO_DATA",
      seq: Number(b.seq) || 0,
      rssi: typeof b.rssi === "number" ? b.rssi : null,
      lastSeen: now
    };

    //store history
    pushHistory("water", {
      time: now,
      cm: latest.water.cm,
      status: latest.water.status,
      rssi: latest.water.rssi
    });
  }

  //city node update
  if (b.node === "CITY") {
    latest.city = {
      tempC: typeof b.tempC === "number" ? b.tempC : null,
      humidity: typeof b.humidity === "number" ? b.humidity : null,
      rainRaw: typeof b.rainRaw === "number" ? b.rainRaw : null,
      rainPercent: typeof b.rainPercent === "number" ? b.rainPercent : null,
      pressurehPa: typeof b.pressurehPa === "number" ? b.pressurehPa : null,
      altitudeM: typeof b.altitudeM === "number" ? b.altitudeM : null,
      status: b.status || "NO_DATA",
      seq: Number(b.seq) || 0,
      rssi: typeof b.rssi === "number" ? b.rssi : null,
      lastSeen: now
    };

    //store history
    pushHistory("city", {
      time: now,
      tempC: latest.city.tempC,
      humidity: latest.city.humidity,
      rainPercent: latest.city.rainPercent,
      pressurehPa: latest.city.pressurehPa,
      status: latest.city.status
    });
  }

  //flood wall node update
  if (b.node === "WALL") {
    latest.wall = {
      state: b.state || "NO_DATA",
      triggeredBy: b.triggeredBy || "NO_DATA",
      seq: Number(b.seq) || 0,
      rssi: typeof b.rssi === "number" ? b.rssi : null,
      snr: typeof b.snr === "number" ? b.snr : null,
      lastSeen: now
    };

    //store history
    pushHistory("wall", {
      time: now,
      state: latest.wall.state,
      triggeredBy: latest.wall.triggeredBy,
      rssi: latest.wall.rssi,
      snr: latest.wall.snr
    });
  }

  res.sendStatus(200);
});

//resident dashboard route
app.get("/resident", requireResident, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "residentDashboard.html"));
});

//authority dashboard route
app.get("/authority", requireAuthority, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "authorityDashboard.html"));
});

//authority nodes page
app.get("/authority/nodes", requireAuthority, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "authorityNodes.html"));
});

//logout route
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Could not log out");
    }

    //clear session cookie
    res.clearCookie("connect.sid");
    return res.redirect("/index.html");
  });
});

//start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});