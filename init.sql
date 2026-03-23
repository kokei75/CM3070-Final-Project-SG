--enable foreign key constraints
PRAGMA foreign_keys = ON;

--remove existing tables if they exist
DROP TABLE IF EXISTS residents;
DROP TABLE IF EXISTS authorities;

--create residents table
CREATE TABLE residents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

--create authorities table
CREATE TABLE authorities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

--insert default resident account (password is hashed)
INSERT OR IGNORE INTO residents (name, username, password)
VALUES ('Alice Resident', 'alice', '$2b$10$okF.gnb0z.c4AeUmCRk/WexpbIp0jACwFG5HnsiS72WdYaf23OgVy');

--insert default authority account (password is hashed)
INSERT OR IGNORE INTO authorities (name, username, password)
VALUES ('Bob Authority', 'admin!', '$2b$10$DtRwz4Hh2f5frus8Kb8MLOS4E26SDBYMLd39/AePJYoHZfz.rbQxq');
