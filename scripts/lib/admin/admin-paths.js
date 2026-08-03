/**
 * Writable admin data root.
 * Local/dev: <repo>/data
 * Vercel: /tmp/duck-wod-admin (serverless FS is read-only except /tmp)
 */
const path = require("path");

function adminDataRoot() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "duck-wod-admin");
  }
  return path.join(process.cwd(), "data");
}

function adminSnapshotsDir() {
  return path.join(adminDataRoot(), "admin-snapshots");
}

function adminClaimsDir() {
  return path.join(adminDataRoot(), "admin-claims");
}

function adminMetaPath() {
  return path.join(adminDataRoot(), "admin-meta.json");
}

function adminCoachTrainingRoot() {
  return path.join(adminDataRoot(), "coach-training");
}

module.exports = {
  adminDataRoot,
  adminSnapshotsDir,
  adminClaimsDir,
  adminMetaPath,
  adminCoachTrainingRoot,
};
