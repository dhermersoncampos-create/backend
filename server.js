const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// ---- ROTA DE REGISTRO ----
app.post("/auth/register", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios!" });
  }

  // Simulação de criação de conta (sem banco de dados)
  return res.status(200).json({ ok: true });
});

// ---- ROTA DE LOGIN ----
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios!" });
  }

  // Simulação de login
  return res.status(200).json({ ok: true });
});

// ROTA PRINCIPAL
app.get("/", (req, res) => {
  res.send("API ONLINE!");
});

// ---- INICIAR SERVIDOR ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando na porta " + PORT));
