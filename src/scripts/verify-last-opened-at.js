/**
 * Verification script for the `lastOpenedAt` field.
 *
 * Use this to confirm that:
 *   1. The User schema has the new lastOpenedAt field
 *   2. The auth routes update it (run before+after a sign-in to observe)
 *   3. No background process is silently writing it
 *
 * Usage:
 *   node src/scripts/verify-last-opened-at.js [--watch] [--user <emailOrId>]
 *
 *   --watch         Print updates to lastOpenedAt every 5 seconds (use during manual test:
 *                   start the watcher, then sign in via the app, observe the change)
 *   --user X        Watch a specific user (email or Mongo _id). Default: most recently
 *                   opened user.
 *
 * Env required:
 *   MONGO_URI   Mongo connection string (same one the API uses)
 */

const mongoose = require("mongoose");

require("dotenv").config(); // load .env if present
const { User } = require("../models/user");

const args = process.argv.slice(2);
const WATCH = args.includes("--watch");
const userArg = args[args.indexOf("--user") + 1];
const userSelector = (args.indexOf("--user") >= 0 && userArg) ? userArg : null;

async function findUser() {
  if (userSelector) {
    if (userSelector.match(/^[0-9a-f]{24}$/i)) {
      return await User.findById(userSelector).lean();
    }
    return await User.findOne({ email: userSelector }).lean();
  }
  // Most recently opened user, or fall back to most recent login
  return await User.findOne({ lastOpenedAt: { $ne: null } })
    .sort({ lastOpenedAt: -1 })
    .lean()
    || await User.findOne().sort({ lastLogin: -1 }).lean();
}

async function snapshot() {
  return {
    totalUsers: await User.countDocuments({}),
    withLastOpenedAt: await User.countDocuments({ lastOpenedAt: { $ne: null } }),
    withLastActivityTime: await User.countDocuments({ lastActivityTime: { $ne: null } }),
    withLastLogin: await User.countDocuments({ lastLogin: { $ne: null } }),
  };
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("ERROR: MONGO_URI env required");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to Mongo");

  // Confirm schema has the field
  const paths = User.schema.paths;
  if (!paths.lastOpenedAt) {
    console.error("ERROR: User schema does not include lastOpenedAt. Update src/models/user.js");
    process.exit(1);
  }
  console.log("Schema check: lastOpenedAt is", paths.lastOpenedAt.instance, paths.lastOpenedAt.options);

  // Population stats
  console.log("\nCurrent population stats:");
  console.log(JSON.stringify(await snapshot(), null, 2));

  const user = await findUser();
  if (!user) {
    console.log("\nNo user found to watch.");
    await mongoose.disconnect();
    return;
  }

  console.log("\nWatching user:", user._id.toString(),
    " email:", user.email, " current lastOpenedAt:", user.lastOpenedAt);

  if (!WATCH) {
    console.log("\n(pass --watch to poll every 5s; useful while exercising sign-in via the app)");
    await mongoose.disconnect();
    return;
  }

  console.log("\nPolling every 5 seconds. Sign in via the app to trigger an update. Ctrl+C to stop.");
  let last = user.lastOpenedAt ? user.lastOpenedAt.toISOString() : null;
  setInterval(async () => {
    const u = await User.findById(user._id).lean();
    const cur = u.lastOpenedAt ? u.lastOpenedAt.toISOString() : null;
    if (cur !== last) {
      console.log(`[${new Date().toISOString()}] lastOpenedAt changed: ${last} → ${cur}`);
      last = cur;
    } else {
      process.stdout.write(".");
    }
  }, 5000);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
