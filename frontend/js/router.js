// Attach route guards and role-based redirect logic globally.
(function attachRouter(global) {
  // Resolve role from storage, and compute it from token when missing.
  async function resolveCurrentRole() {
    const savedRole = AppAuth.getStoredRole();
    if (savedRole) {
      return savedRole;
    }
    const token = AppAuth.getToken();
    if (!token) {
      return null;
    }
    return AppAuth.cacheRoleFromToken(token);
  }

  // Redirect users to dashboard based on role.
  function redirectByRole(role) {
    if (role === 'admin') {
      window.location.href = './admin-control.html';
      return;
    }
    window.location.href = './user.html';
  }

  // Guard admin page so only authenticated admins can access it.
  async function guardAdminPage() {
    const token = AppAuth.getToken();
    if (!token) {
      window.location.href = './login.html';
      return false;
    }
    const role = await resolveCurrentRole();
    if (role !== 'admin') {
      window.location.href = './user.html';
      return false;
    }
    return true;
  }

  // Guard user page so authenticated non-admin users can access it.
  async function guardUserPage() {
    const token = AppAuth.getToken();
    if (!token) {
      window.location.href = './login.html';
      return false;
    }
    const role = await resolveCurrentRole();
    if (role === 'admin') {
      window.location.href = './admin-control.html';
      return false;
    }
    return true;
  }

  // Prevent logged-in users from revisiting login/register pages.
  async function guardGuestPage() {
    const token = AppAuth.getToken();
    if (!token) {
      return true;
    }
    const role = await resolveCurrentRole();
    redirectByRole(role);
    return false;
  }

  global.AppRouter = {
    resolveCurrentRole,
    redirectByRole,
    guardAdminPage,
    guardUserPage,
    guardGuestPage
  };
})(window);
