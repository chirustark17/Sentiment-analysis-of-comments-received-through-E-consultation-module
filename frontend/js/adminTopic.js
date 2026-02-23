// Handle admin topic creation form with JSON-only submission.
(function attachAdminTopic(global) {
  const el = {
    globalNavbar: document.getElementById('globalNavbar'),
    form: document.getElementById('topicCreateForm'),
    titleInput: document.getElementById('topicTitle'),
    descriptionInput: document.getElementById('topicDescription'),
    submitBtn: document.getElementById('submitTopicBtn'),
    cancelBtn: document.getElementById('cancelTopicBtn'),
    statusMessage: document.getElementById('topicFormStatusMessage')
  };

  function showSuccessMessage(message) {
    AppUi.showAlert(el.statusMessage, message, 'success');
  }

  function showErrorMessage(message) {
    AppUi.showAlert(el.statusMessage, message, 'danger');
  }

  function redirectToControlPanel() {
    window.location.href = './admin-control.html';
  }

  function validateForm() {
    const title = String(el.titleInput?.value || '').trim();
    const description = String(el.descriptionInput?.value || '').trim();

    if (!title) {
      throw new Error('Topic Title is required.');
    }
    if (!description) {
      throw new Error('Topic Description is required.');
    }
    return { title, description };
  }

  async function submitTopic() {
    const payload = validateForm();

    // Uses centralized fetch wrapper with Authorization header.
    await AppApi.post('/admin/topics', payload);
  }

  async function initTopicForm() {
    const isAllowed = await AppRouter.guardAdminPage();
    if (!isAllowed) {
      return;
    }

    AppUi.renderNavbar(el.globalNavbar, 'Create Topic');

    if (!el.form || !el.submitBtn || !el.cancelBtn) {
      return;
    }

    el.cancelBtn.addEventListener('click', redirectToControlPanel);

    el.form.addEventListener('submit', (event) => {
      event.preventDefault();
      AppUi.clearAlert(el.statusMessage);

      AppUi.withButtonLoading(el.submitBtn, 'Submitting...', async () => {
        await submitTopic();
      }).then(() => {
        showSuccessMessage('Topic created successfully. Redirecting to analytics dashboard...');
        setTimeout(() => {
          window.location.href = './admin.html';
        }, 700);
      }).catch((error) => {
        showErrorMessage(error.message || 'Unable to create topic.');
      });
    });
  }

  global.AdminTopic = {
    initTopicForm,
    validateForm,
    submitTopic,
    showSuccessMessage,
    showErrorMessage,
    redirectToControlPanel
  };

  initTopicForm();
})(window);
