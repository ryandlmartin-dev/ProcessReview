/* ===================================================
   ProcessReview — Lightweight Canvas Charts
   No external dependencies - pure canvas rendering
   =================================================== */

class MiniChart {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = options;
    this.animProgress = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  animate(duration = 800) {
    const start = performance.now();
    const step = (now) => {
      this.animProgress = Math.min((now - start) / duration, 1);
      this.animProgress = 1 - Math.pow(1 - this.animProgress, 3); // easeOutCubic
      this.draw();
      if (this.animProgress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  getThemeColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      text: style.getPropertyValue('--text-primary').trim(),
      textSecondary: style.getPropertyValue('--text-secondary').trim(),
      textTertiary: style.getPropertyValue('--text-tertiary').trim(),
      border: style.getPropertyValue('--border-light').trim(),
      bg: style.getPropertyValue('--bg-tertiary').trim(),
    };
  }

  draw() {} // Override in subclass
}

/* ---------- Sparkline ---------- */
class Sparkline extends MiniChart {
  constructor(container, values, color = '#6366f1') {
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    super(canvas);
    this.values = values;
    this.color = color;
    this.animate(600);
  }

  draw() {
    const { ctx, width, height, values, color, animProgress } = this;
    ctx.clearRect(0, 0, width, height);

    const max = Math.max(...values) * 1.1;
    const min = Math.min(...values) * 0.9;
    const range = max - min || 1;
    const step = width / (values.length - 1);
    const points = values.map((v, i) => ({
      x: i * step,
      y: height - ((v - min) / range) * height * 0.85 - height * 0.05,
    }));

    // Draw area
    ctx.beginPath();
    ctx.moveTo(points[0].x, height);
    points.forEach((p, i) => {
      const progress = Math.min(animProgress * values.length / (i + 1), 1);
      const y = height - (height - p.y) * progress;
      if (i === 0) ctx.lineTo(p.x, y);
      else {
        const prev = points[i - 1];
        const prevY = height - (height - prev.y) * Math.min(animProgress * values.length / i, 1);
        const cpx = (prev.x + p.x) / 2;
        ctx.bezierCurveTo(cpx, prevY, cpx, y, p.x, y);
      }
    });
    ctx.lineTo(width, height);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color + '30');
    gradient.addColorStop(1, color + '05');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    points.forEach((p, i) => {
      const progress = Math.min(animProgress * values.length / (i + 1), 1);
      const y = height - (height - p.y) * progress;
      if (i === 0) ctx.moveTo(p.x, y);
      else {
        const prev = points[i - 1];
        const prevY = height - (height - prev.y) * Math.min(animProgress * values.length / i, 1);
        const cpx = (prev.x + p.x) / 2;
        ctx.bezierCurveTo(cpx, prevY, cpx, y, p.x, y);
      }
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/* ---------- Bar Chart ---------- */
class BarChart extends MiniChart {
  constructor(canvas, data) {
    super(canvas);
    this.data = data;
    this.animate(1000);
  }

  draw() {
    const { ctx, width, height, data, animProgress } = this;
    const colors = this.getThemeColors();
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 10, right: 20, bottom: 40, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const maxVal = Math.max(...data.datasets.flatMap(d => d.values)) * 1.15;
    const barGroupWidth = chartW / data.labels.length;
    const barWidth = Math.min(barGroupWidth * 0.25, 24);
    const barGap = 3;

    // Grid lines
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = colors.textTertiary;
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      const val = Math.round(maxVal * (1 - i / 4));
      ctx.fillText(val, padding.left - 8, y + 4);
    }

    // Bars
    data.datasets.forEach((dataset, di) => {
      data.labels.forEach((label, li) => {
        const x = padding.left + li * barGroupWidth + (barGroupWidth - (barWidth * data.datasets.length + barGap * (data.datasets.length - 1))) / 2 + di * (barWidth + barGap);
        const val = dataset.values[li];
        const barH = (val / maxVal) * chartH * animProgress;
        const y = padding.top + chartH - barH;

        ctx.beginPath();
        const radius = 4;
        ctx.moveTo(x, y + radius);
        ctx.arcTo(x, y, x + barWidth, y, radius);
        ctx.arcTo(x + barWidth, y, x + barWidth, y + barH, radius);
        ctx.lineTo(x + barWidth, padding.top + chartH);
        ctx.lineTo(x, padding.top + chartH);
        ctx.closePath();
        ctx.fillStyle = dataset.color;
        ctx.fill();
      });
    });

    // X-axis labels
    ctx.fillStyle = colors.textTertiary;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    data.labels.forEach((label, i) => {
      const x = padding.left + i * barGroupWidth + barGroupWidth / 2;
      ctx.fillText(label, x, height - 12);
    });
  }
}

/* ---------- Line Chart ---------- */
class LineChart extends MiniChart {
  constructor(canvas, data) {
    super(canvas);
    this.data = data;
    this.animate(1000);
  }

  draw() {
    const { ctx, width, height, data, animProgress } = this;
    const colors = this.getThemeColors();
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 10, right: 20, bottom: 40, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const maxVal = Math.max(...data.values) * 1.15;
    const minVal = Math.min(...data.values) * 0.85;
    const range = maxVal - minVal || 1;
    const stepX = chartW / (data.labels.length - 1);

    // Grid
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillStyle = colors.textTertiary;
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      const val = (maxVal - (maxVal - minVal) * (i / 4)).toFixed(1);
      ctx.fillText(val, padding.left - 8, y + 4);
    }

    // Line
    const points = data.values.map((v, i) => ({
      x: padding.left + i * stepX,
      y: padding.top + chartH - ((v - minVal) / range) * chartH,
    }));

    // Area fill
    ctx.beginPath();
    ctx.moveTo(points[0].x, padding.top + chartH);
    points.forEach((p, i) => {
      const x = p.x;
      const y = padding.top + chartH - (padding.top + chartH - p.y) * animProgress;
      if (i === 0) ctx.lineTo(x, y);
      else {
        const prev = points[i - 1];
        const prevY = padding.top + chartH - (padding.top + chartH - prev.y) * animProgress;
        const cpx = (prev.x + x) / 2;
        ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
      }
    });
    ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, (data.color || COLORS.blue) + '25');
    gradient.addColorStop(1, (data.color || COLORS.blue) + '02');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    points.forEach((p, i) => {
      const y = padding.top + chartH - (padding.top + chartH - p.y) * animProgress;
      if (i === 0) ctx.moveTo(p.x, y);
      else {
        const prev = points[i - 1];
        const prevY = padding.top + chartH - (padding.top + chartH - prev.y) * animProgress;
        const cpx = (prev.x + p.x) / 2;
        ctx.bezierCurveTo(cpx, prevY, cpx, y, p.x, y);
      }
    });
    ctx.strokeStyle = data.color || COLORS.blue;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Dots
    if (animProgress > 0.8) {
      points.forEach((p) => {
        const y = padding.top + chartH - (padding.top + chartH - p.y) * animProgress;
        ctx.beginPath();
        ctx.arc(p.x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = data.color || COLORS.blue;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      });
    }

    // X-axis labels
    ctx.fillStyle = colors.textTertiary;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    data.labels.forEach((label, i) => {
      ctx.fillText(label, padding.left + i * stepX, height - 12);
    });
  }
}

/* ---------- Donut Chart ---------- */
class DonutChart extends MiniChart {
  constructor(canvas, data) {
    super(canvas);
    this.data = data;
    this.animate(1200);
  }

  draw() {
    const { ctx, width, height, data, animProgress } = this;
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) - 10;
    const innerRadius = radius * 0.65;
    const total = data.values.reduce((a, b) => a + b, 0);
    let startAngle = -Math.PI / 2;

    data.values.forEach((val, i) => {
      const sliceAngle = (val / total) * Math.PI * 2 * animProgress;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = data.colors[i];
      ctx.fill();
      startAngle += sliceAngle;
    });
  }
}

/* ---------- Horizontal Bar Chart ---------- */
class HBarChart extends MiniChart {
  constructor(canvas, data) {
    super(canvas);
    this.data = data;
    this.animate(1000);
  }

  draw() {
    const { ctx, width, height, data, animProgress } = this;
    const colors = this.getThemeColors();
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 10, right: 20, bottom: 10, left: 80 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const barHeight = Math.min(chartH / data.labels.length - 12, 22);
    const maxVal = Math.max(...data.values) * 1.15;

    data.labels.forEach((label, i) => {
      const y = padding.top + (chartH / data.labels.length) * i + (chartH / data.labels.length - barHeight) / 2;
      const barW = (data.values[i] / maxVal) * chartW * animProgress;

      // Label
      ctx.fillStyle = colors.textSecondary;
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(label, padding.left - 12, y + barHeight / 2 + 4);

      // Bar background
      ctx.beginPath();
      const bgRadius = barHeight / 2;
      ctx.roundRect(padding.left, y, chartW, barHeight, bgRadius);
      ctx.fillStyle = colors.bg;
      ctx.fill();

      // Bar fill
      if (barW > 0) {
        ctx.beginPath();
        ctx.roundRect(padding.left, y, Math.max(barW, barHeight), barHeight, bgRadius);
        ctx.fillStyle = data.colors ? data.colors[i] : COLORS.blue;
        ctx.fill();
      }

      // Value
      if (animProgress > 0.5) {
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(Math.round(data.values[i] * animProgress), padding.left + barW + 8, y + barHeight / 2 + 4);
      }
    });
  }
}

/* ---------- Stacked Bar Chart ---------- */
class StackedBarChart extends MiniChart {
  constructor(canvas, data) {
    super(canvas);
    this.data = data;
    this.animate(1000);
  }

  draw() {
    const { ctx, width, height, data, animProgress } = this;
    const colors = this.getThemeColors();
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 10, right: 20, bottom: 40, left: 70 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const barHeight = Math.min(chartH / data.labels.length - 10, 24);
    const maxVal = Math.max(...data.labels.map((_, i) =>
      data.datasets.reduce((sum, d) => sum + d.values[i], 0)
    )) * 1.15;

    data.labels.forEach((label, i) => {
      const y = padding.top + (chartH / data.labels.length) * i + (chartH / data.labels.length - barHeight) / 2;

      // Label
      ctx.fillStyle = colors.textSecondary;
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(label, padding.left - 12, y + barHeight / 2 + 4);

      // Stacked bars
      let xOffset = padding.left;
      data.datasets.forEach((dataset) => {
        const barW = (dataset.values[i] / maxVal) * chartW * animProgress;
        ctx.beginPath();
        ctx.roundRect(xOffset, y, Math.max(barW, 1), barHeight, 3);
        ctx.fillStyle = dataset.color;
        ctx.fill();
        xOffset += barW;
      });
    });

    // Legend at bottom
    let legendX = padding.left;
    data.datasets.forEach((dataset) => {
      ctx.beginPath();
      ctx.arc(legendX + 5, height - 12, 5, 0, Math.PI * 2);
      ctx.fillStyle = dataset.color;
      ctx.fill();
      ctx.fillStyle = colors.textSecondary;
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(dataset.label, legendX + 14, height - 8);
      legendX += ctx.measureText(dataset.label).width + 30;
    });
  }
}

// Polyfill roundRect for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'number') r = [r];
    const [tl = 0] = r;
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tl, y);
    this.quadraticCurveTo(x + w, y, x + w, y + tl);
    this.lineTo(x + w, y + h - tl);
    this.quadraticCurveTo(x + w, y + h, x + w - tl, y + h);
    this.lineTo(x + tl, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - tl);
    this.lineTo(x, y + tl);
    this.quadraticCurveTo(x, y, x + tl, y);
    this.closePath();
    return this;
  };
}
