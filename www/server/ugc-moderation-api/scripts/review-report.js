/**
 * Mark a report reviewed or removed (admin).
 * Usage:
 *   ADMIN_API_KEY=secret MONGODB_URI=mongodb://127.0.0.1:27017/ugc_moderation node scripts/review-report.js <reportMongoId> reviewed
 *   node scripts/review-report.js <reportMongoId> removed
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const { Report, REPORT_STATUSES } = require("../src/models/Report");

async function run() {
  const id = process.argv[2];
  const status = process.argv[3];
  if (!id || !status) {
    console.error("Usage: node scripts/review-report.js <reportId> <reviewed|removed|pending>");
    process.exit(1);
  }
  if (!REPORT_STATUSES.includes(status)) {
    console.error("Invalid status", REPORT_STATUSES);
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ugc_moderation";
  await mongoose.connect(uri);
  const doc = await Report.findByIdAndUpdate(
    id,
    { status, reviewedAt: new Date(), reviewedBy: "cli-admin" },
    { new: true }
  ).lean();
  console.log(doc || "not found");
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
