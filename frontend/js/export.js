// Export already-fetched admin comments into CSV and JSON files.
(function attachExport(global) {
  function nowForFilename() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function normalizeSentiment(sentiment) {
    const normalized = String(sentiment ?? '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');
    if (normalized === 'positive' || normalized === 'pos' || normalized.includes('positive')) {
      return 'Positive';
    }
    if (normalized === 'negative' || normalized === 'neg' || normalized.includes('negative')) {
      return 'Negative';
    }
    return 'Neutral';
  }

  function normalizeUserType(role) {
    const normalized = String(role ?? '').trim().toLowerCase();
    if (normalized === 'expert') {
      return 'Expert';
    }
    if (normalized === 'citizen') {
      return 'Citizen';
    }
    return 'Unknown';
  }

  function normalizeCommentRecord(comment) {
    return {
      comment_id: comment?.id ?? '',
      comment_text: String(comment?.comment_text ?? ''),
      user_type: normalizeUserType(comment?.user_role),
      sentiment_label: normalizeSentiment(comment?.sentiment_label ?? comment?.sentiment ?? comment?.predicted_sentiment),
      timestamp: comment?.created_at ? new Date(comment.created_at).toISOString() : ''
    };
  }

  function escapeCsvCell(value) {
    const text = String(value ?? '');
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function convertToCSV(commentsData) {
    const rows = Array.isArray(commentsData) ? commentsData : [];
    const header = 'comment_id,comment_text,user_type,sentiment_label,timestamp';
    const lines = rows.map((item) => {
      return [
        escapeCsvCell(item.comment_id),
        escapeCsvCell(item.comment_text),
        escapeCsvCell(item.user_type),
        escapeCsvCell(item.sentiment_label),
        escapeCsvCell(item.timestamp)
      ].join(',');
    });
    return [header, ...lines].join('\r\n');
  }

  function triggerDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportCSV(commentsData) {
    const normalized = (Array.isArray(commentsData) ? commentsData : []).map(normalizeCommentRecord);
    const csv = convertToCSV(normalized);
    triggerDownload(`\uFEFF${csv}`, `sentiment_data_${nowForFilename()}.csv`, 'text/csv;charset=utf-8;');
  }

  function exportJSON(commentsData) {
    const normalized = (Array.isArray(commentsData) ? commentsData : []).map(normalizeCommentRecord);
    const json = JSON.stringify(normalized, null, 2);
    triggerDownload(json, `sentiment_data_${nowForFilename()}.json`, 'application/json;charset=utf-8;');
  }

  global.AppExport = {
    exportCSV,
    exportJSON,
    convertToCSV,
    triggerDownload
  };
})(window);
