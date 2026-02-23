// Attach shared UI helpers for navbar, alerts, and loading states.
(function attachUi(global) {
  const SESSION_MESSAGE_KEY = 'mca_session_message';

  // Escape dynamic text inserted into HTML templates.
  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // Persist a flash message across redirects (e.g., after 401 redirect to login).
  function setFlashMessage(message, type) {
    const payload = {
      message: String(message || '').trim(),
      type: type || 'warning'
    };
    sessionStorage.setItem(SESSION_MESSAGE_KEY, JSON.stringify(payload));
  }

  // Read and clear one-time flash message.
  function consumeFlashMessage() {
    const raw = sessionStorage.getItem(SESSION_MESSAGE_KEY);
    if (!raw) {
      return null;
    }
    sessionStorage.removeItem(SESSION_MESSAGE_KEY);
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  }

  // Build a standard Bootstrap alert inside the target node.
  function showAlert(targetNode, message, type) {
    if (!targetNode) {
      return;
    }
    const level = type || 'info';
    targetNode.innerHTML = `
      <div class="alert alert-${level} alert-dismissible fade show mb-0" role="alert">
        <span>${escapeHtml(message || '')}</span>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
  }

  // Clear any alert currently shown in target node.
  function clearAlert(targetNode) {
    if (!targetNode) {
      return;
    }
    targetNode.innerHTML = '';
  }

  // Build text + spinner HTML for loading buttons.
  function loadingButtonHtml(text) {
    return `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      ${escapeHtml(text)}
    `;
  }

  // Toggle button disabled/loading UI.
  function setButtonLoading(button, isLoading, loadingText) {
    if (!button) {
      return;
    }
    if (isLoading) {
      if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
      }
      button.disabled = true;
      const fallback = button.dataset.loadingText || button.textContent.trim() || 'Loading...';
      const label = loadingText || fallback;
      button.innerHTML = loadingButtonHtml(label);
      return;
    }
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
    button.disabled = false;
  }

  // Run an async task while button stays disabled and displays spinner.
  async function withButtonLoading(button, loadingText, task) {
    setButtonLoading(button, true, loadingText);
    try {
      await task();
    } finally {
      setButtonLoading(button, false);
    }
  }

  // Redirect users to login with a consistent session-expired message.
  function handleUnauthorizedRedirect(message) {
    AppAuth.clearSession();
    setFlashMessage(message || 'Session expired. Please login again.', 'warning');
    window.location.href = './login.html';
  }

  // Render shared top navbar for authenticated admin/user screens.
  function renderNavbar(targetNode, pageTitle) {
    if (!targetNode) {
      return;
    }
    const role = AppAuth.getStoredRole() || 'user';
    const roleBadgeClass = role === 'admin' ? 'text-bg-danger' : role === 'expert' ? 'text-bg-info' : 'text-bg-secondary';
    const displayName = AppAuth.getDisplayName() || 'User';

    targetNode.innerHTML = `
      <nav class="navbar navbar-expand-lg border-bottom app-navbar">
        <div class="container-fluid py-2">
          <a class="navbar-brand fw-semibold" href="#">MCA Sentiment Console</a>
          <div class="d-flex align-items-center gap-2 ms-auto flex-wrap">
            <span class="small text-muted">Signed in as <strong>${escapeHtml(displayName)}</strong></span>
            <span class="badge ${roleBadgeClass} text-uppercase">${escapeHtml(role)}</span>
            <button id="globalLogoutBtn" type="button" class="btn btn-outline-danger btn-sm">Logout</button>
          </div>
        </div>
      </nav>
      <div class="container-fluid py-2">
        <h1 class="h4 mb-0">${escapeHtml(pageTitle || 'Dashboard')}</h1>
      </div>
    `;

    const logoutBtn = targetNode.querySelector('#globalLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => AppAuth.logout());
    }
  }

  global.AppUi = {
    setFlashMessage,
    consumeFlashMessage,
    showAlert,
    clearAlert,
    setButtonLoading,
    withButtonLoading,
    handleUnauthorizedRedirect,
    renderNavbar
  };
})(window);
