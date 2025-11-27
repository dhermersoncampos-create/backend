require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mercadopago = require("mercadopago");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ----- SQLite -----
const DB_PATH = path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password_hash TEXT,
      balance REAL DEFAULT 0
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      mp_payment_id TEXT,
      amount REAL,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
});

// ----- Mercado Pago (versão 1.5.13) -----
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

// JWT SECRET
const JWT_SECRET = process.env.JWT_SECRET;

// ----- Função gerar token -----
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// ----- Middleware de Autenticação -----
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Token não enviado" });

  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer")
    return res.status(401).json({ error: "Token inválido" });

  try {
    const payload = jwt.verify(parts[1], JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token expirado ou inválido" });
  }
}

// ----- Registro -----
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email e senha obrigatórios" });

    const password_hash = await bcrypt.hash(password, 10);

    const stmt = db.prepare(
      "INSERT INTO users (email, password_hash) VALUES (?, ?)"
    );

    stmt.run(email, password_hash, function (err) {
      if (err) {
        if (err.code === "SQLITE_CONSTRAINT")
          return res.status(400).json({ error: "Email já cadastrado" });

        return res.status(500).json({ error: "Erro ao criar usuário" });
      }

      const token = generateToken({ id: this.lastID, email });
      return res.json({
        user: { id: this.lastID, email },
        token,
      });
    });

    stmt.finalize();
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Erro interno" });
  }
});

// ----- Login -----
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, row) => {
      if (!row) return res.status(400).json({ error: "Credenciais inválidas" });

      const match = await bcrypt.compare(password, row.password_hash);
      if (!match)
        return res.status(400).json({ error: "Credenciais inválidas" });

      const token = generateToken({ id: row.id, email });
      return res.json({
        user: { id: row.id, email: row.email, balance: row.balance },
        token,
      });
    }
  );
});

// ----- Rota ME -----
app.get("/me", authMiddleware, (req, res) => {
  db.get(
    "SELECT id, email, balance FROM users WHERE id = ?",
    [req.user.id],
    (err, row) => {
      return res.json({ user: row });
    }
  );
});

// ----- Depósito PIX -----
app.post("/deposit", async (req, res) => {
  try {
    const { amount, email, userId } = req.body;

    if (!amount || amount < 2)
      return res.status(400).json({ error: "Depósito mínimo é R$ 2" });

    const payment = await mercadopago.payment.create({
      transaction_amount: Number(amount),
      description: "Depósito CrashBet",
      payment_method_id: "pix",
      payer: {
        email: email || "cliente@email.com",
      },
    });

    return res.json({
      id: payment.body.id,
      qrCode: payment.body.point_of_interaction.transaction_data.qr_code,
      qrBase64:
        payment.body.point_of_interaction.transaction_data.qr_code_base64,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Erro ao gerar Pix" });
  }
});

// ----- TESTE -----
app.get("/", (req, res) => {
  res.send("Backend + Login + Pix rodando 🚀");
});

app.listen(3000, () => console.log("🔥 Servidor rodando na porta 3000"));