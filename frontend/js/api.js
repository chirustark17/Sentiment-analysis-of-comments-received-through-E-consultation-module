// Attach centralized API request helpers for all frontend pages.
(function attachApi(global) {
  // Build request headers and auto-attach Authorization for protected APIs.
  function buildHeaders(customHeaders, includeAuth, hasBody) {
    const headers = Object.assign({ Accept: 'application/json' }, customHeaders || {});
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }
    if (includeAuth) {
      const token = AppAuth.getToken();
      if (!token) {
        throw new Error('Please login first.');
      }
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  // Parse server response body safely whether it is JSON or empty.
  function parseResponseBody(rawText) {
    if (!rawText) {
      return {};
    }
    try {
      return JSON.parse(rawText);
    } catch (_error) {
      throw new Error('Server returned invalid JSON.');
    }
  }

  // Centralized fetch wrapper for all frontend API calls.
  async function request(path, options) {
    const config = options || {};
    const method = config.method || 'GET';
    const includeAuth = config.auth !== false;
    const hasBody = Boolean(config.body);
    const headers = buildHeaders(config.headers, includeAuth, hasBody);

    const response = await fetch(`${AppUtils.API_BASE_URL}${path}`, {
      method,
      headers,
      body: hasBody ? JSON.stringify(config.body) : undefined
    });

    const rawText = await response.text();
    const data = parseResponseBody(rawText);

    if (!response.ok) {
      if (response.status === 401) {
        if (global.AppUi && typeof global.AppUi.handleUnauthorizedRedirect === 'function') {
          global.AppUi.handleUnauthorizedRedirect('Session expired. Please login again.');
        } else {
          AppAuth.clearSession();
          window.location.href = './login.html';
        }
        throw new Error('Session expired. Please login again.');
      }
      const message = data.error || data.message || `Request failed (${response.status}).`;
      throw new Error(message);
    }
    return data;
  }

  // Convenience helper for GET requests.
  function get(path, options) {
    return request(path, Object.assign({}, options, { method: 'GET' }));
  }

  // Convenience helper for POST requests.
  function post(path, body, options) {
    return request(path, Object.assign({}, options, { method: 'POST', body }));
  }

  global.AppApi = {
    request,
    get,
    post
  };
})(window);
