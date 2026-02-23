/* global Chart, WordCloud */

const state = {
  currentPage: 1,
  totalPages: 1,
  chart: null,
  lastWords: []
};

// Centralized references keep DOM lookups out of request/render logic.
const el = {
  apiBaseInput: document.getElementById('apiBaseInput'),
  tokenInput: document.getElementById('tokenInput'),
  topicSelect: document.getElementById('topicSelect'),
  roleSelect: document.getElementById('roleSelect'),
  loadTopicsBtn: document.getElementById('loadTopicsBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  summarizeBtn: document.getElementById('summarizeBtn'),
  wordCloudBtn: document.getElementById('wordCloudBtn'),
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

// API status messages are shown in a single strip under the controls.
function setStatus(message, type = 'info') {
  el.statusMessage.className = `small mt-3 status-${type}`;
  el.statusMessage.textContent = message;
}

function getApiBase() {
  return el.apiBaseInput.value.trim().replace(/\/+$/, '');
}

function getAuthToken() {
  return el.tokenInput.value.trim();
}

function getSelectedTopicId() {
  const value = el.topicSelect.value;
  return value ? Number(value) : null;
}

function getSelectedRole() {
  return el.roleSelect.value || null;
}

function ensureTopicSelected() {
  const topicId = getSelectedTopicId();
  if (!topicId) {
    throw new Error('Please select a topic first.');
  }
  return topicId;
}

// Reusable fetch wrapper for authenticated JSON APIs.
async function apiRequest(path, options = {}) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Admin JWT token is required.');
  }

  const headers = { Accept: 'application/json' };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${getApiBase()}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const rawText = await response.text();
  let data = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      throw new Error('Invalid JSON response from server.');
    }
  }

  if (!response.ok) {
    const errorMessage = data.error || data.message || `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data;
}

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

// Comment rows mirror backend fields from /admin/comments.
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
    item.innerHTML = `
      <div class="comment-meta">#${comment.id} | ${comment.user_role || 'unknown'} | ${createdAt}</div>
      <div class="comment-text">${escapeHtml(comment.comment_text || '')}</div>
    `;

    el.commentsList.appendChild(item);
  }
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderCounts(analytics) {
  el.totalCommentsCount.textContent = analytics.total_comments ?? 0;
  el.analyzedCount.textContent = analytics.analyzed_count ?? 0;
  el.pendingCount.textContent = analytics.pending_analysis_count ?? 0;
  el.positiveCount.textContent = analytics.positive_count ?? 0;
  el.neutralCount.textContent = analytics.neutral_count ?? 0;
  el.negativeCount.textContent = analytics.negative_count ?? 0;
}

function renderSentimentChart(analytics) {
  const chartData = [
    analytics.positive_count ?? 0,
    analytics.neutral_count ?? 0,
    analytics.negative_count ?? 0
  ];

  const ctx = document.getElementById('sentimentChart');
  if (!state.chart) {
    state.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Positive', 'Neutral', 'Negative'],
        datasets: [
          {
            data: chartData,
            backgroundColor: ['#198754', '#6c757d', '#dc3545'],
            borderWidth: 1
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  } else {
    state.chart.data.datasets[0].data = chartData;
    state.chart.update();
  }
}

function renderPagination(page, totalPages) {
  state.currentPage = page;
  state.totalPages = totalPages > 0 ? totalPages : 1;

  el.pageIndicator.textContent = String(state.currentPage);
  el.totalPagesIndicator.textContent = String(state.totalPages);
  el.prevPageBtn.disabled = state.currentPage <= 1;
  el.nextPageBtn.disabled = state.currentPage >= state.totalPages;
}

function resizeWordCloudCanvas() {
  const parentWidth = el.wordCloudCanvas.parentElement.clientWidth;
  const targetWidth = Math.max(420, Math.floor(parentWidth - 12));
  el.wordCloudCanvas.width = targetWidth;
  el.wordCloudCanvas.height = 360;
}

// Convert backend [{text, value}] into WordCloud.js pair format.
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

  // Render weighted words provided by backend /admin/wordcloud.
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

async function loadTopics() {
  setStatus('Loading topics...', 'info');
  const data = await apiRequest('/topics');
  const topics = data.topics || [];
  renderTopics(topics);

  if (topics.length) {
    setStatus(`Loaded ${topics.length} topic(s).`, 'ok');
    state.currentPage = 1;
    await refreshDashboard();
  } else {
    setStatus('No topics found.', 'info');
  }
}

async function loadAnalytics() {
  const topicId = ensureTopicSelected();
  const role = getSelectedRole();
  const rolePart = role ? `&role=${encodeURIComponent(role)}` : '';
  const data = await apiRequest(`/admin/analytics?topic_id=${topicId}${rolePart}`);
  const analytics = data.analytics || {};

  renderCounts(analytics);
  renderSentimentChart(analytics);
}

async function loadComments(page = 1) {
  const topicId = ensureTopicSelected();
  const role = getSelectedRole();
  const rolePart = role ? `&role=${encodeURIComponent(role)}` : '';
  const data = await apiRequest(`/admin/comments?topic_id=${topicId}&page=${page}${rolePart}`);

  renderCommentList(data.comments || []);

  const totalPages = data.pagination?.total_pages ?? 1;
  const currentPage = data.filters?.page ?? page;
  renderPagination(currentPage, totalPages);
}

async function refreshDashboard() {
  setStatus('Refreshing dashboard...', 'info');
  await Promise.all([loadAnalytics(), loadComments(state.currentPage)]);
  setStatus('Dashboard updated.', 'ok');
}

async function runSentimentAnalysis() {
  const topicId = ensureTopicSelected();
  const role = getSelectedRole();
  setStatus('Running sentiment analysis...', 'info');

  const payload = { topic_id: topicId, role };
  const data = await apiRequest('/admin/analyze-sentiment', { method: 'POST', body: payload });
  setStatus(data.message || 'Sentiment analysis completed.', 'ok');
  state.currentPage = 1;
  await refreshDashboard();
}

async function runSummarization() {
  const topicId = ensureTopicSelected();
  const role = getSelectedRole();
  setStatus('Generating summary...', 'info');

  const payload = { topic_id: topicId, role };
  const data = await apiRequest('/admin/summarize', { method: 'POST', body: payload });
  el.summaryText.textContent = data.summary || 'No summary returned.';
  setStatus('Summary generated.', 'ok');
}

async function runWordCloud() {
  const topicId = ensureTopicSelected();
  const role = getSelectedRole();
  const rolePart = role ? `&role=${encodeURIComponent(role)}` : '';
  setStatus('Generating word cloud...', 'info');

  const data = await apiRequest(`/admin/wordcloud?topic_id=${topicId}${rolePart}`);
  drawWordCloud(data.word_frequencies || []);
  setStatus('Word cloud generated.', 'ok');
}

async function withErrorHandling(task) {
  try {
    await task();
  } catch (error) {
    setStatus(error.message || 'Unexpected error.', 'error');
  }
}

// Bind all controls once and route actions through shared error handling.
function bindEvents() {
  el.loadTopicsBtn.addEventListener('click', () => withErrorHandling(loadTopics));
  el.refreshBtn.addEventListener('click', () => withErrorHandling(async () => {
    state.currentPage = 1;
    await refreshDashboard();
  }));
  el.analyzeBtn.addEventListener('click', () => withErrorHandling(runSentimentAnalysis));
  el.summarizeBtn.addEventListener('click', () => withErrorHandling(runSummarization));
  el.wordCloudBtn.addEventListener('click', () => withErrorHandling(runWordCloud));

  el.prevPageBtn.addEventListener('click', () => withErrorHandling(async () => {
    if (state.currentPage > 1) {
      await loadComments(state.currentPage - 1);
    }
  }));

  el.nextPageBtn.addEventListener('click', () => withErrorHandling(async () => {
    if (state.currentPage < state.totalPages) {
      await loadComments(state.currentPage + 1);
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

function init() {
  bindEvents();
  renderPagination(1, 1);
  drawWordCloud([]);
  setStatus('Paste admin token, load topics, then refresh dashboard.', 'info');
}

init();
