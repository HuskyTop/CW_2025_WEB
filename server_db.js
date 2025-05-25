const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('users_sims.db');

// Створюємо таблицю користувачів, якщо ще не існує
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )
  `, (err) => {
    if (err) console.error("Error creating users table:", err.message);
    else console.log("Users table created or already exists.");
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS simulations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      simulation_number INTEGER,
      volume REAL,
      speed INTEGER,
      density REAL,
      turbulence REAL,
      length INTEGER,
      thickness INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) console.error("Error creating simulations table:", err.message);
    else {
      console.log("Simulations table created or already exists.");
    }
  });
});


module.exports = db;
