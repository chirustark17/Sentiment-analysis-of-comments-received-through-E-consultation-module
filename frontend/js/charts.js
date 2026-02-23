/* global Chart */
// Modular chart renderer utilities for admin dashboard analytics.
(function attachCharts(global) {
  const chartRegistry = new WeakMap();

  const palette = {
    positive: '#2f9e44',
    neutral: '#f1c40f',
    negative: '#e03131'
  };

  function resolveContext(ctx) {
    if (!ctx) {
      return null;
    }
    if (ctx.canvas) {
      return ctx;
    }
    if (typeof ctx.getContext === 'function') {
      return ctx.getContext('2d');
    }
    return null;
  }

  function destroyChart(chartInstance) {
    if (chartInstance && typeof chartInstance.destroy === 'function') {
      chartInstance.destroy();
    }
  }

  function createChart(ctx, config) {
    const context = resolveContext(ctx);
    if (!context) {
      return null;
    }

    const existing = chartRegistry.get(context.canvas);
    if (existing) {
      destroyChart(existing);
    }

    const chart = new Chart(context, {
      ...config,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        ...config.options,
        plugins: {
          tooltip: {
            enabled: true
          },
          ...config.options?.plugins
        }
      }
    });

    chartRegistry.set(context.canvas, chart);
    return chart;
  }

  function renderSentimentPie(ctx, data) {
    const labels = ['Positive', 'Neutral', 'Negative'];
    const values = [
      Number(data?.positive) || 0,
      Number(data?.neutral) || 0,
      Number(data?.negative) || 0
    ];

    return createChart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: [palette.positive, palette.neutral, palette.negative],
            borderColor: [palette.positive, palette.neutral, palette.negative],
            borderWidth: 1
          }
        ]
      },
      options: {
        cutout: '56%',
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  global.AppCharts = {
    destroyChart,
    renderSentimentPie
  };
})(window);
