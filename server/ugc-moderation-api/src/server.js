require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const termsRouter = require("./routes/terms");
const settingsRouter = require("./routes/settings");
const reportsRouter = require("./routes/reports");
const blocksRouter = require("./routes/blocks");
const moderationRouter = require("./routes/moderation");

const PORT = Number(process.env.PORT) || 3840;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ugc_moderation";

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB connected");

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/v1/terms", termsRouter);
  app.use("/api/v1/users", settingsRouter);
  app.use("/api/v1/reports", reportsRouter);
  app.use("/api/v1/blocks", blocksRouter);
  app.use("/api/v1/moderation", moderationRouter);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  });

  app.listen(PORT, () => {
    console.log(`UGC moderation API listening on http://localhost:${PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
