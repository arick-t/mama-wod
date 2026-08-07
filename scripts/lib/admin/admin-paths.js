/**
 * Vercel (with BLOB_READ_WRITE_TOKEN): private Blob store via admin-json-store
 * Local without Blob: <repo>/data
 * Legacy note: /tmp/duck-wod-admin was ephemeral on serverless and is no longer preferred.
 */
const path = require("path");

function adminDataRoot() {
  if (
    !(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_OIDC_TOKEN) &&
    (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  ) {
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
