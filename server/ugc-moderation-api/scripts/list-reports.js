/**
 * CLI: list pending reports (requires mongo + env same as server).
 * Usage: MONGODB_URI=... node scripts/list-reports.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const { Report } = require("../src/models/Report");

async function run() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ugc_moderation";
  await mongoose.connect(uri);
  const pending = await Report.find({ status: "pending" }).sort({ createdAt: -1 }).limit(50).lean();
  console.log(JSON.stringify(pending, null, 2));
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
