import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { chargersRouter } from "./routes/chargers.js";

// Load .env from project root (one level up from server/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

// Mount API routes
app.use("/api/chargers", chargersRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`[GoaCharge API] Server running on http://localhost:${PORT}`);
});
