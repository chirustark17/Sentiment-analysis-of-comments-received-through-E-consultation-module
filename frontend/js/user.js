// Attach user dashboard behavior for citizen/expert pages.
(function attachUserDashboard(global) {
  const state = {
    topics: []
  };

  const el = {
    globalNavbar: document.getElementById('globalNavbar'),
    globalAlert: document.getElementById('globalAlert'),
    topicSelect: document.getElementById('topicSelect'),
    selectedTopicTitle: document.getElementById('selectedTopicTitle'),
    selectedTopicDescription: document.getElementById('selectedTopicDescription'),
    selectedTopicDocLink: document.getElementById('selectedTopicDocLink'),
    commentText: document.getElementById('commentText'),
    submitCommentBtn: document.getElementById('submitCommentBtn'),
    statusMessage: document.getElementById('userStatusMessage')
  };

  // Render user-page status messages.
  function setStatus(message, type) {
    const level = type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info';
    AppUi.showAlert(el.statusMessage, message, level);
  }

  // Render selected topic details in details panel.
  function renderSelectedTopicDetails() {
    const selectedId = Number(el.topicSelect.value || 0);
    const topic = state.topics.find((item) => Number(item.id) === selectedId);

    if (!topic) {
      if (el.selectedTopicTitle) {
        el.selectedTopicTitle.textContent = 'Select a topic';
      }
      if (el.selectedTopicDescription) {
        el.selectedTopicDescription.textContent = 'Topic details will appear here.';
      }
      if (el.selectedTopicDocLink) {
        el.selectedTopicDocLink.href = '#';
        el.selectedTopicDocLink.classList.add('d-none');
      }
      return;
    }

    if (el.selectedTopicTitle) {
      el.selectedTopicTitle.textContent = topic.title || 'Untitled topic';
    }
    if (el.selectedTopicDescription) {
      el.selectedTopicDescription.textContent = topic.description || 'No description available.';
    }
    if (el.selectedTopicDocLink) {
      if (topic.document_url) {
        el.selectedTopicDocLink.href = topic.document_url;
        el.selectedTopicDocLink.classList.remove('d-none');
      } else {
        el.selectedTopicDocLink.href = '#';
        el.selectedTopicDocLink.classList.add('d-none');
      }
    }
  }

  // Render topics in dropdown for comment submission.
  function renderTopics(topics) {
    el.topicSelect.innerHTML = '';
    if (!topics.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No topics available';
      el.topicSelect.appendChild(option);
      renderSelectedTopicDetails();
      return;
    }

    for (const topic of topics) {
      const option = document.createElement('option');
      option.value = String(topic.id);
      option.textContent = `${topic.id} - ${topic.title}`;
      el.topicSelect.appendChild(option);
    }

    // Auto-select first topic and render details on initial load.
    el.topicSelect.value = String(topics[0].id);
    renderSelectedTopicDetails();
  }

  // Load available topics from authenticated /topics endpoint.
  async function loadTopics() {
    setStatus('Loading topics...', 'info');
    const data = await AppApi.get('/topics');
    state.topics = data.topics || [];
    renderTopics(state.topics);
    setStatus(`Loaded ${state.topics.length} topic(s).`, 'success');
  }

  // Submit a comment for selected topic.
  async function submitComment() {
    const topicId = Number(el.topicSelect.value || 0);
    const commentText = String(el.commentText.value || '').trim();
    if (!topicId) {
      throw new Error('Please select a topic.');
    }
    if (!commentText) {
      throw new Error('Please enter your comment.');
    }
    const payload = {
      topic_id: topicId,
      comment_text: commentText
    };
    await AppApi.post('/comments', payload);
    el.commentText.value = '';
  }

  // Wrap user actions with consistent status/error rendering.
  async function withErrorHandling(task) {
    try {
      AppUi.clearAlert(el.globalAlert);
      await task();
    } catch (error) {
      const message = error.message || 'Unexpected error.';
      setStatus(message, 'error');
      AppUi.showAlert(el.globalAlert, message, 'danger');
    }
  }

  // Attach user page events once.
  function bindEvents() {
    el.topicSelect.addEventListener('change', renderSelectedTopicDetails);
    el.submitCommentBtn.addEventListener('click', () => withErrorHandling(async () => {
      await AppUi.withButtonLoading(el.submitCommentBtn, 'Submitting...', async () => {
        setStatus('Submitting comment...', 'info');
        await submitComment();
      });
      setStatus('Comment submitted successfully.', 'success');
    }));
  }

  // Initialize user dashboard only after auth guard allows access.
  async function init() {
    const isAllowed = await AppRouter.guardUserPage();
    if (!isAllowed) {
      return;
    }
    AppUi.renderNavbar(el.globalNavbar, 'Citizen/Expert Dashboard');
    bindEvents();
    await withErrorHandling(loadTopics);
  }

  init();
})(window);
