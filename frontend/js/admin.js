/* global WordCloud, AppCharts, AppReport, AppExport */
// Attach admin dashboard behavior and API integration.
(function attachAdminDashboard(global) {
  const CHART_RENDERERS = {
    sentimentPie: {
      canvasId: 'sentimentChart',
      cardId: 'sentimentPieCard',
      render: (ctx, data) => AppCharts.renderSentimentPie(ctx, data.sentimentPie)
    }
  };

  const DEFAULT_SELECTED_CHARTS = ['sentimentPie'];

  const state = {
    currentPage: 1,
    totalPages: 1,
    chartInstances: {},
    chartData: null,
    analyticsSnapshot: null,
    commentsData: [],
    lastWords: []
  };

  const el = {
    globalNavbar: document.getElementById('globalNavbar'),
    globalAlert: document.getElementById('globalAlert'),
    topicSelect: document.getElementById('topicSelect'),
    roleSelect: document.getElementById('roleSelect'),
    loadTopicsBtn: document.getElementById('loadTopicsBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    summarizeBtn: document.getElementById('summarizeBtn'),
    wordCloudBtn: document.getElementById('wordCloudBtn'),
    generateReportBtn: document.getElementById('generateReportBtn'),
    downloadCsvBtn: document.getElementById('downloadCsvBtn'),
    downloadJsonBtn: document.getElementById('downloadJsonBtn'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    statusMessage: document.getElementById('statusMessage'),
    commentsList: document.getElementById('commentsList'),
    pageIndicator: document.getElementById('pageIndicator'),
    totalPagesIndicator: document.getElementById('totalPagesIndicator'),
    totalCommentsCount: document.getElementById('totalCommentsCount'),
    analyzedCount: document.getElementById('analyzedCount'),
    pendingCount: document.getElementById('pendingCount'),
    positiveCount: document.getElementById('positiveCount'),
    neutralCount: document.getElementById('neutralCount'),
    negativeCount: document.getElementById('negativeCount'),
    summaryText: document.getElementById('summaryText'),
    wordCloudCanvas: document.getElementById('wordCloudCanvas')
  };

  function syncWindowStore() {
    global.AdminDashboardStore = {
      commentsData: [...state.commentsData],
      chartData: state.chartData,
      analytics: state.analyticsSnapshot,
      summaryText: String(el.summaryText?.textContent || ''),
      topicId: getSelectedTopicId(),
      topicName: getSelectedTopicName(),
      role: getSelectedRole(),
      updatedAt: new Date().toISOString()
    };
  }

  // Map dashboard status type to Bootstrap alert flavor.
  function toAlertType(type) {
    if (type === 'ok') {
      return 'success';
    }
    if (type === 'error') {
      return 'danger';
    }
    return 'info';
  }

  // Render status message below controls.
  function setStatus(message, type) {
    AppUi.showAlert(el.statusMessage, message, toAlertType(type));
  }

  // Show critical page-level errors in top alert area.
  function setGlobalError(message) {
    AppUi.showAlert(el.globalAlert, message, 'danger');
  }

  // Read selected topic id and convert it to number.
  function getSelectedTopicId() {
    const value = el.topicSelect.value;
    return value ? Number(value) : null;
  }

  // Read optional role filter (citizen/expert/all).
  function getSelectedRole() {
    return el.roleSelect.value || null;
  }

  // Read current selected topic text for report metadata.
  function getSelectedTopicName() {
    const option = el.topicSelect.options?.[el.topicSelect.selectedIndex];
    if (!option) {
      return 'N/A';
    }
    return option.textContent || 'N/A';
  }

  // Ensure topic is selected before calling topic-specific endpoints.
  function ensureTopicSelected() {
    const topicId = getSelectedTopicId();
    if (!topicId) {
      throw new Error('Please select a topic first.');
    }
    return topicId;
  }

  // Render topic dropdown from backend /topics response.
  function renderTopics(topics) {
    el.topicSelect.innerHTML = '';
    if (!topics.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No topics available';
      el.topicSelect.appendChild(option);
      return;
    }
    for (const topic of topics) {
      const option = document.createElement('option');
      option.value = String(topic.id);
      option.textContent = `${topic.id} - ${topic.title}`;
      el.topicSelect.appendChild(option);
    }
  }

  // Escape HTML to prevent unsafe comment rendering in dashboard list.
  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // Normalize sentiment label to Positive/Neutral/Negative.
  function normalizeSentiment(sentiment) {
    const normalized = String(sentiment ?? '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');
    if (!normalized) {
      return 'neutral';
    }
    if (normalized === 'positive' || normalized === 'pos' || normalized.includes('positive')) {
      return 'positive';
    }
    if (normalized === 'negative' || normalized === 'neg' || normalized.includes('negative')) {
      return 'negative';
    }
    if (normalized === 'neutral' || normalized === 'neu' || normalized.includes('neutral')) {
      return 'neutral';
    }
    return 'neutral';
  }

  // Render a compact right-aligned badge for comment sentiment.
  function getSentimentBadgeHtml(sentiment) {
    const normalized = normalizeSentiment(sentiment);
    if (normalized === 'positive') {
      return '<span class="sentiment-badge sentiment-positive">&#x1F7E2; Positive</span>';
    }
    if (normalized === 'negative') {
      return '<span class="sentiment-badge sentiment-negative">&#x1F534; Negative</span>';
    }
    return '<span class="sentiment-badge sentiment-neutral">&#x1F7E1; Neutral</span>';
  }

  // Render paginated admin comments list.
  function renderCommentList(comments) {
    el.commentsList.innerHTML = '';
    if (!comments.length) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'list-group-item comment-item text-muted';
      emptyItem.textContent = 'No comments found for current filters.';
      el.commentsList.appendChild(emptyItem);
      return;
    }
    for (const comment of comments) {
      const item = document.createElement('div');
      item.className = 'list-group-item comment-item';
      const createdAt = comment.created_at ? new Date(comment.created_at).toLocaleString() : 'Unknown';
      const sentiment =
        comment.sentiment_label ??
        comment.sentiment ??
        comment.predicted_sentiment ??
        '';
      item.innerHTML = `
        <div class="comment-meta-row">
          <div class="comment-meta">#${comment.id} | ${comment.user_role || 'unknown'} | ${createdAt}</div>
          ${getSentimentBadgeHtml(sentiment)}
        </div>
        <div class="comment-text">${escapeHtml(comment.comment_text || '')}</div>
      `;
      el.commentsList.appendChild(item);
    }
  }

  // Render top-level analytics counters.
  function renderCounts(analytics) {
    el.totalCommentsCount.textContent = analytics.total_comments ?? 0;
    el.analyzedCount.textContent = analytics.analyzed_count ?? 0;
    el.pendingCount.textContent = analytics.pending_analysis_count ?? 0;
    el.positiveCount.textContent = analytics.positive_count ?? 0;
    el.neutralCount.textContent = analytics.neutral_count ?? 0;
    el.negativeCount.textContent = analytics.negative_count ?? 0;
  }

  // Build dataset only for Sentiment Pie.
  function buildChartData(analytics) {
    const positive = Number(analytics?.positive_count) || 0;
    const neutral = Number(analytics?.neutral_count) || 0;
    const negative = Number(analytics?.negative_count) || 0;

    return {
      sentimentPie: { positive, neutral, negative }
    };
  }

  // Destroy all active chart instances before reset/re-render.
  function clearCharts() {
    for (const key of Object.keys(state.chartInstances)) {
      AppCharts.destroyChart(state.chartInstances[key]);
      state.chartInstances[key] = null;
    }
  }

  // Render sentiment pie chart.
  function renderSelectedCharts() {
    if (!state.chartData) return;

    const chartKey = DEFAULT_SELECTED_CHARTS[0];
    const config = CHART_RENDERERS[chartKey];
    if (!config) return;

    const card = document.getElementById(config.cardId);
    const canvas = document.getElementById(config.canvasId);
    if (!card || !canvas) return;

    // Destroy previous chart if exists
    if (state.chartInstances[chartKey]) {
      AppCharts.destroyChart(state.chartInstances[chartKey]);
    }

    const ctx = canvas.getContext('2d');
    state.chartInstances[chartKey] = config.render(ctx, state.chartData);
  }

  // Keep paging controls in sync with current comments page.
  function renderPagination(page, totalPages) {
    state.currentPage = page;
    state.totalPages = totalPages > 0 ? totalPages : 1;
    el.pageIndicator.textContent = String(state.currentPage);
    el.totalPagesIndicator.textContent = String(state.totalPages);
    el.prevPageBtn.disabled = state.currentPage <= 1;
    el.nextPageBtn.disabled = state.currentPage >= state.totalPages;
  }

  // Resize word cloud canvas so it fits card width.
  function resizeWordCloudCanvas() {
    const parentWidth = el.wordCloudCanvas.parentElement.clientWidth;
    const targetWidth = Math.max(420, Math.floor(parentWidth - 12));
    el.wordCloudCanvas.width = targetWidth;
    el.wordCloudCanvas.height = 360;
  }

  // Draw weighted word cloud from backend-provided frequencies.
  function drawWordCloud(words) {
    resizeWordCloudCanvas();
    const list = words.map((item) => [item.text, item.value]);
    state.lastWords = words;

    if (!list.length) {
      const ctx = el.wordCloudCanvas.getContext('2d');
      ctx.clearRect(0, 0, el.wordCloudCanvas.width, el.wordCloudCanvas.height);
      ctx.fillStyle = '#6b778c';
      ctx.font = '16px sans-serif';
      ctx.fillText('No terms available for current filters.', 20, 40);
      return;
    }

    WordCloud(el.wordCloudCanvas, {
      list,
      gridSize: 10,
      weightFactor: (size) => Math.max(12, size * 2),
      backgroundColor: '#fbfdff',
      color: () => ['#0a58ca', '#198754', '#d63384', '#fd7e14'][Math.floor(Math.random() * 4)],
      rotateRatio: 0.25,
      minRotation: -Math.PI / 4,
      maxRotation: Math.PI / 4
    });
  }

  // Load all topics for admin controls.
  async function loadTopics() {
    setStatus('Loading topics...', 'info');
    const data = await AppApi.get('/topics');
    const topics = data.topics || [];
    renderTopics(topics);
    if (topics.length) {
      setStatus(`Loaded ${topics.length} topic(s).`, 'ok');
      state.currentPage = 1;
      await refreshDashboard();
      return;
    }
    setStatus('No topics found.', 'info');
  }

  // Load analytics summary for the selected topic and role filter.
  async function loadAnalytics() {
    const topicId = ensureTopicSelected();
    const role = getSelectedRole();
    const rolePart = role ? `&role=${encodeURIComponent(role)}` : '';
    const data = await AppApi.get(`/admin/analytics?topic_id=${topicId}${rolePart}`);
    const analytics = data.analytics || {};
    renderCounts(analytics);
    state.analyticsSnapshot = analytics;
    state.chartData = buildChartData(analytics);
    clearCharts();
    renderSelectedCharts();
    syncWindowStore();
  }

  // Load paginated comments for current topic and role filter.
  async function loadComments(page) {
    const topicId = ensureTopicSelected();
    const role = getSelectedRole();
    const rolePart = role ? `&role=${encodeURIComponent(role)}` : '';
    const data = await AppApi.get(`/admin/comments?topic_id=${topicId}&page=${page}${rolePart}`);
    state.commentsData = data.comments || [];
    renderCommentList(state.commentsData);
    const totalPages = data.pagination?.total_pages ?? 1;
    const currentPage = data.filters?.page ?? page;
    renderPagination(currentPage, totalPages);
    syncWindowStore();
  }

  // Refresh full dashboard state in one action.
  async function refreshDashboard() {
    setStatus('Refreshing dashboard...', 'info');
    await Promise.all([loadAnalytics(), loadComments(state.currentPage)]);
    setStatus('Dashboard updated.', 'ok');
  }

  // Trigger backend sentiment analysis and refresh dashboard.
  async function runSentimentAnalysis() {
    const topicId = ensureTopicSelected();
    const role = getSelectedRole();
    setStatus('Running sentiment analysis...', 'info');
    const payload = { topic_id: topicId, role };
    const data = await AppApi.post('/admin/analyze-sentiment', payload);
    setStatus(data.message || 'Sentiment analysis completed.', 'ok');
    state.currentPage = 1;
    await refreshDashboard();
  }

  // Trigger backend summarization and render summary text.
  async function runSummarization() {
    const topicId = ensureTopicSelected();
    const role = getSelectedRole();
    setStatus('Generating summary...', 'info');
    const payload = { topic_id: topicId, role };
    const data = await AppApi.post('/admin/summarize', payload);
    el.summaryText.textContent = data.summary || 'No summary returned.';
    syncWindowStore();
    setStatus('Summary generated.', 'ok');
  }

  function ensureReportReady() {
    if (!state.analyticsSnapshot || !state.chartData?.sentimentPie) {
      throw new Error('No analytics loaded. Click "Refresh Dashboard" before generating report.');
    }
  }

  function ensureExportReady() {
    if (!state.commentsData.length) {
      throw new Error('No comment records available for export on the current page.');
    }
  }

  // Request word frequencies and redraw cloud.
  async function runWordCloud() {
    const topicId = ensureTopicSelected();
    const role = getSelectedRole();
    const rolePart = role ? `&role=${encodeURIComponent(role)}` : '';
    setStatus('Generating word cloud...', 'info');
    const data = await AppApi.get(`/admin/wordcloud?topic_id=${topicId}${rolePart}`);
    drawWordCloud(data.word_frequencies || []);
    setStatus('Word cloud generated.', 'ok');
  }

  // Wrap dashboard tasks to display clean error messages.
  async function withErrorHandling(task) {
    try {
      AppUi.clearAlert(el.globalAlert);
      await task();
    } catch (error) {
      const message = error.message || 'Unexpected error.';
      setStatus(message, 'error');
      setGlobalError(message);
    }
  }

  // Register all button/dropdown events once.
  function bindEvents() {
    el.loadTopicsBtn.addEventListener('click', () => withErrorHandling(async () => {
      await AppUi.withButtonLoading(el.loadTopicsBtn, 'Loading Topics...', loadTopics);
    }));

    el.refreshBtn.addEventListener('click', () => withErrorHandling(async () => {
      await AppUi.withButtonLoading(el.refreshBtn, 'Refreshing...', async () => {
        state.currentPage = 1;
        await refreshDashboard();
      });
    }));

    el.analyzeBtn.addEventListener('click', () => withErrorHandling(async () => {
      await AppUi.withButtonLoading(el.analyzeBtn, 'Analyzing...', runSentimentAnalysis);
    }));

    el.summarizeBtn.addEventListener('click', () => withErrorHandling(async () => {
      await AppUi.withButtonLoading(el.summarizeBtn, 'Summarizing...', runSummarization);
    }));

    el.wordCloudBtn.addEventListener('click', () => withErrorHandling(async () => {
      await AppUi.withButtonLoading(el.wordCloudBtn, 'Generating...', runWordCloud);
    }));

    if (el.generateReportBtn) {
      el.generateReportBtn.addEventListener('click', () => withErrorHandling(async () => {
        ensureReportReady();
        await AppUi.withButtonLoading(el.generateReportBtn, 'Generating Report...', async () => {
          await AppReport.generateReport({
            systemName: 'E-Consultation Sentiment Analysis System',
            projectTitle: 'Sentiment Analysis of Comments through E-Consultation',
            topicName: getSelectedTopicName(),
            generatedDate: new Date().toISOString(),
            preparedBy: 'System Generated',
            analytics: global.AdminDashboardStore?.analytics || state.analyticsSnapshot,
            chartData: global.AdminDashboardStore?.chartData || state.chartData,
            summaryText: global.AdminDashboardStore?.summaryText || el.summaryText.textContent,
            sentimentCanvas: document.getElementById('sentimentChart')
          });
        });
        setStatus('Official report downloaded.', 'ok');
      }));
    }

    if (el.downloadCsvBtn) {
      el.downloadCsvBtn.addEventListener('click', () => withErrorHandling(async () => {
        ensureExportReady();
        await AppUi.withButtonLoading(el.downloadCsvBtn, 'Exporting CSV...', async () => {
          AppExport.exportCSV(global.AdminDashboardStore?.commentsData || state.commentsData);
        });
        setStatus('CSV export downloaded.', 'ok');
      }));
    }

    if (el.downloadJsonBtn) {
      el.downloadJsonBtn.addEventListener('click', () => withErrorHandling(async () => {
        ensureExportReady();
        await AppUi.withButtonLoading(el.downloadJsonBtn, 'Exporting JSON...', async () => {
          AppExport.exportJSON(global.AdminDashboardStore?.commentsData || state.commentsData);
        });
        setStatus('JSON export downloaded.', 'ok');
      }));
    }

    el.prevPageBtn.addEventListener('click', () => withErrorHandling(async () => {
      if (state.currentPage > 1) {
        await AppUi.withButtonLoading(el.prevPageBtn, 'Loading...', async () => {
          await loadComments(state.currentPage - 1);
        });
      }
    }));

    el.nextPageBtn.addEventListener('click', () => withErrorHandling(async () => {
      if (state.currentPage < state.totalPages) {
        await AppUi.withButtonLoading(el.nextPageBtn, 'Loading...', async () => {
          await loadComments(state.currentPage + 1);
        });
      }
    }));

    el.topicSelect.addEventListener('change', () => withErrorHandling(async () => {
      state.currentPage = 1;
      await refreshDashboard();
    }));

    el.roleSelect.addEventListener('change', () => withErrorHandling(async () => {
      state.currentPage = 1;
      await refreshDashboard();
    }));

    window.addEventListener('resize', () => {
      if (state.lastWords.length) {
        drawWordCloud(state.lastWords);
      } else {
        drawWordCloud([]);
      }
    });
  }

  // Initialize default dashboard state after auth guard passes.
  async function init() {
    const isAllowed = await AppRouter.guardAdminPage();
    if (!isAllowed) {
      return;
    }
    AppUi.renderNavbar(el.globalNavbar, 'Admin Dashboard');
    bindEvents();
    renderSelectedCharts();
    renderPagination(1, 1);
    drawWordCloud([]);
    syncWindowStore();
    setStatus('Authenticated. Click "Load Topics" to start.', 'info');
  }

  init();
})(window);
