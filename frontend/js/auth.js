// Attach authentication helpers and form handlers globally.
(function attachAuth(global) {
  // Persist JWT so protected pages can authenticate API requests.
  function setToken(token) {
    localStorage.setItem(AppUtils.TOKEN_KEY, token);
  }

  // Read JWT from storage for auth guards and API calls.
  function getToken() {
    return localStorage.getItem(AppUtils.TOKEN_KEY) || '';
  }

  // Persist role for fast role-based redirects on page load.
  function setRole(role) {
    const normalized = AppUtils.normalizeRole(role);
    if (!normalized) {
      return;
    }
    localStorage.setItem(AppUtils.ROLE_KEY, normalized);
  }

  // Persist display name used in shared navbar.
  function setDisplayName(name) {
    const value = String(name || '').trim();
    if (!value) {
      return;
    }
    localStorage.setItem(AppUtils.USER_NAME_KEY, value);
  }

  // Read stored role for route guards.
  function getStoredRole() {
    return AppUtils.normalizeRole(localStorage.getItem(AppUtils.ROLE_KEY));
  }

  // Read stored display name for navbar.
  function getDisplayName() {
    return String(localStorage.getItem(AppUtils.USER_NAME_KEY) || '').trim();
  }

  // Remove auth state during logout or invalid-session handling.
  function clearSession() {
    localStorage.removeItem(AppUtils.TOKEN_KEY);
    localStorage.removeItem(AppUtils.ROLE_KEY);
    localStorage.removeItem(AppUtils.USER_NAME_KEY);
  }

  // Decode role from JWT and cache it so route guards stay fast and consistent.
  function cacheRoleFromToken(token) {
    const payload = AppUtils.decodeJwtPayload(token);
    const role = AppUtils.getRoleFromJwtPayload(payload);
    if (role) {
      setRole(role);
    }
    const displayName = AppUtils.getDisplayNameFromJwtPayload(payload);
    if (displayName) {
      setDisplayName(displayName);
    }
    return role;
  }

  // Redirect helper to keep page navigation consistent.
  function goTo(page) {
    window.location.href = page;
  }

  // Show auth form status messages in login/register screens.
  function setAuthMessage(message, type) {
    const messageNode = document.getElementById('authMessage');
    if (!messageNode) {
      return;
    }
    messageNode.className = `small mt-3 auth-${type || 'info'}`;
    messageNode.textContent = message;
  }

  // Display one-time flash message (used by 401 redirect flow).
  function renderFlashMessage() {
    if (!global.AppUi || typeof global.AppUi.consumeFlashMessage !== 'function') {
      return;
    }
    const flash = global.AppUi.consumeFlashMessage();
    if (!flash || !flash.message) {
      return;
    }
    const mappedType = flash.type === 'warning' ? 'error' : flash.type;
    setAuthMessage(flash.message, mappedType || 'info');
  }

  // Execute login call and persist token + role from backend response.
  async function login(email, password) {
    const data = await AppApi.request('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password }
    });

    const token = data.access_token;
    const role = data.role;

    if (!token || !role) {
      throw new Error('Login response missing token or role.');
    }

    setToken(token);
    setRole(role);
    const payload = AppUtils.decodeJwtPayload(token);
    const displayName =
      data.full_name ||
      data.name ||
      email ||   // fallback to login email
      AppUtils.getDisplayNameFromJwtPayload(payload);
    if (displayName) {
      setDisplayName(displayName);
    }

    return { token, role };
  }

  // Execute register call for citizen/expert users.
  async function register(payload) {
    return AppApi.request('/auth/register', {
      method: 'POST',
      auth: false,
      body: payload
    });
  }

  // Clear session and move user to login page.
  function logout() {
    clearSession();
    goTo('./login.html');
  }

  // Submit handler for login page form.
  async function onLoginSubmit(event) {
    event.preventDefault();
    setAuthMessage('Logging in...', 'info');

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');

    try {
      const result = await login(email, password);
      setAuthMessage('Login successful. Redirecting...', 'success');
      AppRouter.redirectByRole(result.role);
    } catch (error) {
      setAuthMessage(error.message || 'Login failed.', 'error');
    }
  }

  // Submit handler for registration page form.
  async function onRegisterSubmit(event) {
    event.preventDefault();
    setAuthMessage('Registering account...', 'info');

    const formData = new FormData(event.currentTarget);
    const payload = {
      full_name: String(formData.get('full_name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      password: String(formData.get('password') || ''),
      role: String(formData.get('role') || '').trim().toLowerCase()
    };

    try {
      await register(payload);
      setAuthMessage('Registration successful. Redirecting to login...', 'success');
      setTimeout(() => goTo('./login.html'), 700);
    } catch (error) {
      setAuthMessage(error.message || 'Registration failed.', 'error');
    }
  }

  // Attach login form event listener if page has login form.
  function bindLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) {
      return;
    }
    form.addEventListener('submit', onLoginSubmit);
    renderFlashMessage();
  }

  // Attach register form event listener if page has register form.
  function bindRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) {
      
      return;
    }
    form.addEventListener('submit', onRegisterSubmit);
    renderFlashMessage();
  }

  global.AppAuth = {
    setToken,
    getToken,
    setRole,
    setDisplayName,
    getStoredRole,
    getDisplayName,
    clearSession,
    cacheRoleFromToken,
    login,
    register,
    logout,
    bindLoginForm,
    bindRegisterForm
  };
})(window);
