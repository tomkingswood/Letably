/**
 * URL Builder Utility
 *
 * Centralises frontend URL construction across the backend.
 */

function getFrontendBaseUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:3000';
}

function buildAgencyUrl(agencySlug, path) {
  return `${getFrontendBaseUrl()}/${agencySlug}/${path}`;
}

function buildPublicUrl(path) {
  return `${getFrontendBaseUrl()}/${path}`;
}

module.exports = { getFrontendBaseUrl, buildAgencyUrl, buildPublicUrl };
