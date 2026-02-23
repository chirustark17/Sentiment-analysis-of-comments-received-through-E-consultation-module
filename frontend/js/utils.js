// Attach shared utility helpers in a single global namespace.
(function attachUtils(global) {
  const TOKEN_KEY = 'mca_access_token';
  const ROLE_KEY = 'mca_user_role';
  const USER_NAME_KEY = 'mca_user_name';
  const API_BASE_URL = 'http://127.0.0.1:5000';

  // Normalize role input so role checks stay consistent across pages.
  function normalizeRole(roleValue) {
    const role = String(roleValue || '').trim().toLowerCase();
    if (role === 'admin' || role === 'citizen' || role === 'expert') {
      return role;
    }
    return null;
  }

  // Decode JWT payload (base64url) so the frontend can inspect claims.
  function decodeJwtPayload(token) {
    try {
      const parts = String(token || '').split('.');
      if (parts.length !== 3) {
        return null;
      }
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decoded = atob(payload);
      return JSON.parse(decoded);
    } catch (_error) {
      return null;
    }
  }

  // Extract role if backend included it in token claims.
  function getRoleFromJwtPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const directRole = normalizeRole(payload.role || payload.user_role);
    if (directRole) {
      return directRole;
    }
    const nestedRole = normalizeRole(payload.claims && payload.claims.role);
    return nestedRole;
  }

  // Extract display name for navbar header using common JWT claim names.
  function getDisplayNameFromJwtPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const direct =
      payload.full_name ||
      payload.name ||
      payload.username ||
      payload.email ||
      payload.sub;
    const value = String(direct || '').trim();
    return value || null;
  }

  global.AppUtils = {
    TOKEN_KEY,
    ROLE_KEY,
    USER_NAME_KEY,
    API_BASE_URL,
    normalizeRole,
    decodeJwtPayload,
    getRoleFromJwtPayload,
    getDisplayNameFromJwtPayload
  };
})(window);
