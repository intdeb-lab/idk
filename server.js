import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const BEARER = process.env.BEARER_TOKEN || "";
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "gpt-4o-mini";
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  }
}));

app.use("/api/", rateLimit({ windowMs: 60_000, max: 30 }));
app.use(express.json({ limit: "1mb" }));

function requireBearer(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!BEARER) return res.status(500).json({ error: "Server misconfig: missing BEARER_TOKEN" });
  if (token !== BEARER) return res.status(401).json({ error: "Unauthorized" });
  next();
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/api/chat", requireBearer, async (req, res) => {
  try {
    const prompt = (req.body?.prompt ?? "").toString().trim();
    const model = (req.body?.model ?? DEFAULT_MODEL).toString();
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });
    const r = await client.responses.create({ model, input: prompt });
    res.json({ model, text: r.output_text ?? "", id: r.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || "Proxy error" });
  }
});

app.get("/api/health", (req, res) => res.json({ ok: true, model: DEFAULT_MODEL }));

app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`DBW Chat proxy running at http://localhost:${PORT}`);
});
