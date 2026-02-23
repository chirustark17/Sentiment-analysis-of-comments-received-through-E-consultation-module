/* global html2canvas */
// Build official institutional PDF reports from already-loaded dashboard data.
(function attachReport(global) {
  const PAGE = {
    width: 210,
    height: 297,
    marginX: 18,
    marginTop: 18,
    marginBottom: 20
  };

  function getJsPdf() {
    return global.jspdf?.jsPDF || null;
  }

  function nowForFilename() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function formatDate(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      return 'N/A';
    }
    return date.toLocaleString();
  }

  function escapeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function toSafeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function toPercent(value, total) {
    if (!total) {
      return '0.00%';
    }
    return `${((value / total) * 100).toFixed(2)}%`;
  }

  function normalizeSummary(summaryText) {
    const clean = escapeText(summaryText);
    if (!clean || clean.toLowerCase() === 'summary will appear here.') {
      return 'At the time of report preparation, no AI-generated summary was available for this topic and selected filter.';
    }
    return clean;
  }

  function paragraph(doc, state, text, options) {
    const width = options?.width || (PAGE.width - PAGE.marginX * 2);
    const lineHeight = options?.lineHeight || 5.5;
    const lines = doc.splitTextToSize(text, width);
    const neededHeight = lines.length * lineHeight + 1;
    ensureSpace(doc, state, neededHeight);
    doc.text(lines, PAGE.marginX, state.y);
    state.y += lines.length * lineHeight;
  }

  function ensureSpace(doc, state, requiredHeight) {
    if (state.y + requiredHeight <= PAGE.height - PAGE.marginBottom) {
      return;
    }
    doc.addPage();
    state.y = PAGE.marginTop;
  }

  function sectionTitle(doc, state, title) {
    ensureSpace(doc, state, 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(33, 37, 41);
    doc.text(title, PAGE.marginX, state.y);
    state.y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(33, 37, 41);
  }

  function drawSentimentTable(doc, state, rows) {
    const left = PAGE.marginX;
    const col1 = 60;
    const col2 = 42;
    const col3 = 42;
    const rowH = 8;
    const tableWidth = col1 + col2 + col3;

    ensureSpace(doc, state, 42);

    doc.setDrawColor(140, 140, 140);
    doc.setLineWidth(0.2);
    doc.rect(left, state.y, tableWidth, rowH);
    doc.rect(left, state.y, col1, rowH);
    doc.rect(left + col1, state.y, col2, rowH);
    doc.rect(left + col1 + col2, state.y, col3, rowH);

    doc.setFont('helvetica', 'bold');
    doc.text('Sentiment', left + 2, state.y + 5.5);
    doc.text('Count', left + col1 + 2, state.y + 5.5);
    doc.text('Percentage', left + col1 + col2 + 2, state.y + 5.5);
    doc.setFont('helvetica', 'normal');

    state.y += rowH;
    for (const row of rows) {
      doc.rect(left, state.y, tableWidth, rowH);
      doc.rect(left, state.y, col1, rowH);
      doc.rect(left + col1, state.y, col2, rowH);
      doc.rect(left + col1 + col2, state.y, col3, rowH);
      doc.text(row.label, left + 2, state.y + 5.5);
      doc.text(String(row.count), left + col1 + 2, state.y + 5.5);
      doc.text(row.percent, left + col1 + col2 + 2, state.y + 5.5);
      state.y += rowH;
    }
  }

  function addFooter(doc) {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i += 1) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(95, 99, 104);
      doc.text('E-Consultation Sentiment Analysis System', PAGE.marginX, PAGE.height - 8);
      doc.text(`Page ${i} of ${totalPages}`, PAGE.width / 2, PAGE.height - 8, { align: 'center' });
      doc.text('Official Use Only', PAGE.width - PAGE.marginX, PAGE.height - 8, { align: 'right' });
    }
  }

  function buildInterpretation(sentimentPie) {
    const positive = toSafeNumber(sentimentPie?.positive);
    const neutral = toSafeNumber(sentimentPie?.neutral);
    const negative = toSafeNumber(sentimentPie?.negative);
    const total = positive + neutral + negative;
    if (!total) {
      return 'No analyzed sentiment records were available for interpretive assessment during this reporting interval.';
    }

    const dominant = positive >= neutral && positive >= negative
      ? 'positive'
      : neutral >= positive && neutral >= negative
        ? 'neutral'
        : 'negative';

    return `The observed sentiment pattern indicates a ${dominant} tendency within stakeholder responses for the selected topic. Positive sentiment accounts for ${toPercent(positive, total)}, neutral sentiment accounts for ${toPercent(neutral, total)}, and negative sentiment accounts for ${toPercent(negative, total)}. These distributions provide a structured view of public perception and support evidence-based administrative review of topic-specific consultation outcomes.`;
  }

  async function captureCharts(chartCanvas) {
    if (!chartCanvas) {
      return null;
    }

    if (chartCanvas.tagName === 'CANVAS' && typeof chartCanvas.toDataURL === 'function') {
      return chartCanvas.toDataURL('image/png', 1.0);
    }

    if (typeof html2canvas === 'function') {
      const rendered = await html2canvas(chartCanvas, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true
      });
      return rendered.toDataURL('image/png', 1.0);
    }

    return null;
  }

  function buildPDFStructure(doc, data) {
    const state = { y: PAGE.marginTop };
    const chartTotal = toSafeNumber(data.sentiment.positive) + toSafeNumber(data.sentiment.neutral) + toSafeNumber(data.sentiment.negative);
    const tableRows = [
      { label: 'Positive', count: toSafeNumber(data.sentiment.positive), percent: toPercent(toSafeNumber(data.sentiment.positive), chartTotal) },
      { label: 'Neutral', count: toSafeNumber(data.sentiment.neutral), percent: toPercent(toSafeNumber(data.sentiment.neutral), chartTotal) },
      { label: 'Negative', count: toSafeNumber(data.sentiment.negative), percent: toPercent(toSafeNumber(data.sentiment.negative), chartTotal) }
    ];

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(33, 37, 41);

    // Cover section
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(data.systemName, PAGE.width / 2, 66, { align: 'center' });
    doc.setFontSize(14);
    doc.text(data.projectTitle, PAGE.width / 2, 82, { align: 'center' });
    doc.setFontSize(15);
    doc.text('Official Sentiment Analysis Report', PAGE.width / 2, 101, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Topic: ${data.topicName}`, PAGE.width / 2, 122, { align: 'center' });
    doc.text(`Generated Date: ${data.generatedDate}`, PAGE.width / 2, 131, { align: 'center' });
    doc.text(`Prepared By: ${data.preparedBy}`, PAGE.width / 2, 140, { align: 'center' });
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.line(PAGE.marginX + 10, 153, PAGE.width - PAGE.marginX - 10, 153);

    doc.addPage();
    state.y = PAGE.marginTop;

    sectionTitle(doc, state, 'Executive Summary');
    paragraph(doc, state, `This document presents an administrative review of sentiment outcomes for the selected e-consultation topic. ${data.executiveSummary}`, { lineHeight: 5.6 });
    state.y += 5;

    sectionTitle(doc, state, 'Section 1: Topic Overview');
    paragraph(doc, state, `Topic Name: ${data.topicName}`, { lineHeight: 5.5 });
    paragraph(doc, state, `Total Comments Under Current Filter: ${toSafeNumber(data.totalComments)}`, { lineHeight: 5.5 });
    paragraph(doc, state, 'The overview consolidates currently available consultation records and provides context for the distribution and interpretation presented in subsequent sections.', { lineHeight: 5.5 });
    state.y += 5;

    sectionTitle(doc, state, 'Section 2: Sentiment Distribution Analysis');
    drawSentimentTable(doc, state, tableRows);
    state.y += 6;

    if (data.chartImage) {
      const imgW = 96;
      const imgH = 72;
      ensureSpace(doc, state, imgH + 6);
      const x = (PAGE.width - imgW) / 2;
      doc.addImage(data.chartImage, 'PNG', x, state.y, imgW, imgH);
      state.y += imgH + 2;
    } else {
      paragraph(doc, state, 'Sentiment chart image was not available at generation time.', { lineHeight: 5.5 });
    }
    state.y += 4;

    sectionTitle(doc, state, 'Section 3: Analytical Interpretation');
    paragraph(doc, state, buildInterpretation(data.sentiment), { lineHeight: 5.6 });
    state.y += 5;

    sectionTitle(doc, state, 'Section 4: AI-Generated Insight Summary');
    paragraph(doc, state, data.insightSummary, { lineHeight: 5.6 });
    state.y += 5;

    sectionTitle(doc, state, 'Conclusion');
    paragraph(
      doc,
      state,
      'Based on the present sentiment distribution and AI-assisted synthesis, this report records the current public response profile for administrative and academic reference. The findings should be interpreted alongside policy context, domain expertise, and longitudinal consultation records where applicable.',
      { lineHeight: 5.6 }
    );

    addFooter(doc);
  }

  async function generateReport(payload) {
    const JsPdf = getJsPdf();
    if (!JsPdf) {
      throw new Error('jsPDF is not available in this page.');
    }

    const sentiment = payload?.chartData?.sentimentPie;
    if (!sentiment) {
      throw new Error('No chart data found. Refresh dashboard before generating report.');
    }

    const chartImage = await captureCharts(payload.sentimentCanvas);
    const doc = new JsPdf({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    buildPDFStructure(doc, {
      systemName: payload.systemName || 'E-Consultation Sentiment Analysis System',
      projectTitle: payload.projectTitle || 'Sentiment Analysis of Comments through E-Consultation',
      topicName: payload.topicName || 'N/A',
      generatedDate: formatDate(payload.generatedDate),
      preparedBy: payload.preparedBy || 'System Generated',
      executiveSummary: normalizeSummary(payload.summaryText),
      totalComments: payload.analytics?.total_comments ?? 0,
      sentiment,
      insightSummary: normalizeSummary(payload.summaryText),
      chartImage
    });

    doc.save(`official_sentiment_report_${nowForFilename()}.pdf`);
  }

  global.AppReport = {
    generateReport,
    captureCharts,
    buildPDFStructure
  };
})(window);
