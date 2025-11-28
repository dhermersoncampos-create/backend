require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ----------- BANCO DE DADOS SQLITE ----------- //
const DB_PATH = path.join(__dirname, "database.db");
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password_hash TEXT,
      balance REAL DEFAULT 0
    )
  `);
});

// ----------- ROTAS ----------- //

// Teste para ver se o servidor está rodando
app.get("/", (req, res) => {
  res.send({ message: "Backend funcionando!" });
});

// Registrar usuário
app.post("/register", (req, res) => {
  const { email, password } = req.body;

  const hash = bcrypt.hashSync(password, 10);

  db.run(
    "INSERT INTO users (email, password_hash) VALUES (?, ?)",
    [email, hash],
    err => {
      if (err) return res.status(400).json({ error: "Email já existe" });
      res.json({ message: "Registrado com sucesso" });
    }
  );
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (!user) return res.status(400).json({ error: "Usuário não existe" });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: "Senha incorreta" });

    const token = jwt.sign({ id: user.id }, "SEGREDO123", {
      expiresIn: "7d",
    });

    res.json({ message: "Login OK", token });
  });
});

// Ver saldo
app.get("/balance", (req, res) => {
  const token = req.headers.authorization;

  if (!token) return res.status(401).json({ error: "Token ausente" });

  try {
    const data = jwt.verify(token, "SEGREDO123");
    db.get(
      "SELECT balance FROM users WHERE id = ?",
      [data.id],
      (err, row) => {
        res.json({ balance: row.balance });
      }
    );
  } catch (e) {
    return res.status(401).json({ error: "Token inválido" });
  }
});

// Porta Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
