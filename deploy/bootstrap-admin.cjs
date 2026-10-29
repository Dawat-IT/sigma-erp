const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!email.includes("@") || password.length < 16) {
    throw new Error("Provide ADMIN_EMAIL and ADMIN_PASSWORD (at least 16 characters)");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.db.collection("users");
  if (await users.findOne({ email })) throw new Error("Account exists; refusing to reset it");
  const now = new Date();
  await users.insertOne({
    email, name: "সিস্টেম অ্যাডমিন", passwordHash: await bcrypt.hash(password, 12),
    role: "admin", isActive: true, locale: "bn", locationIds: [],
    createdAt: now, updatedAt: now,
  });
  console.log("Administrator created");
}
main().catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
