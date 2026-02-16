/* ===================================================
   ProcessReview — Application Logic
   =================================================== */

(function () {
  'use strict';

  // ---- DOM Refs ----
  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menuToggle');
  const themeToggle = document.getElementById('themeToggle');
  const notifBtn = document.getElementById('notifBtn');
  const notifPanel = document.getElementById('notifPanel');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalClose = document.getElementById('modalClose');
  const cancelModal = document.getElementById('cancelModal');
  const processForm = document.getElementById('processForm');
  const toastContainer = document.getElementById('toastContainer');
  const globalSearch = document.getElementById('globalSearch');

  // ---- Navigation ----
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');

  function navigateTo(pageName) {
    navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageName);
    });
    pages.forEach(page => {
      page.classList.toggle('active', page.id === `page-${pageName}`);
    });
    // Close sidebar on mobile
    sidebar.classList.remove('open');
    // Re-render charts on page show
    if (pageName === 'analytics') {
      setTimeout(renderAnalyticsCharts, 100);
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });

  // ---- Mobile Menu ----
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // Close sidebar on overlay click (mobile)
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && e.target !== menuToggle && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    }
  });

  // ---- Theme Toggle ----
  const sunIcon = themeToggle.querySelector('.sun-icon');
  const moonIcon = themeToggle.querySelector('.moon-icon');

  function setTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    sunIcon.style.display = dark ? 'none' : 'block';
    moonIcon.style.display = dark ? 'block' : 'none';
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    // Re-render all visible charts
    setTimeout(renderDashboardCharts, 50);
  }

  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    setTheme(!isDark);
  });

  // Init theme
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    setTheme(true);
  }

  // ---- Notifications ----
  notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notifPanel.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!notifPanel.contains(e.target) && e.target !== notifBtn && !notifBtn.contains(e.target)) {
      notifPanel.classList.remove('open');
    }
  });

  document.getElementById('clearNotifs').addEventListener('click', () => {
    document.querySelectorAll('.notif-item.unread').forEach(item => {
      item.classList.remove('unread');
    });
    const badge = document.querySelector('.notification-badge');
    if (badge) badge.style.display = 'none';
    showToast('All notifications marked as read', 'success');
  });

  function renderNotifications() {
    const list = document.getElementById('notifList');
    list.innerHTML = NOTIFICATIONS.map(n => {
      const iconSvg = getNotifIcon(n.icon);
      return `
        <div class="notif-item ${n.unread ? 'unread' : ''}">
          <div class="notif-icon ${n.type}">${iconSvg}</div>
          <div class="notif-content">
            <div class="notif-text">${n.text}</div>
            <div class="notif-time">${formatDate(n.time)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function getNotifIcon(type) {
    const icons = {
      comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
      check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>',
      x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
      user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    };
    return icons[type] || icons.file;
  }

  // ---- Modal ----
  function openModal() {
    modalOverlay.classList.add('active');
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
  }

  document.getElementById('newProcessBtn').addEventListener('click', openModal);
  document.getElementById('newProcessBtn2').addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  cancelModal.addEventListener('click', closeModal);

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  processForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('procName').value;
    const dept = document.getElementById('procDept').value;
    const priority = document.getElementById('procPriority').value;
    const desc = document.getElementById('procDesc').value;
    const owner = document.getElementById('procOwner').value;

    if (!name) {
      showToast('Please enter a process name', 'error');
      return;
    }

    const newProcess = {
      id: `PR-${1000 + processes.length}`,
      name,
      description: desc || 'No description provided.',
      department: dept || 'Engineering',
      owner: owner || 'Unassigned',
      status: 'pending',
      priority,
      date: new Date(),
      progress: 0,
      comments: 0,
      steps: Math.floor(Math.random() * 5) + 3,
      completedSteps: 0,
    };

    processes.unshift(newProcess);
    closeModal();
    processForm.reset();
    renderProcessTable();
    renderProcessGrid();
    renderReviewBoard();
    showToast(`Process "${name}" created successfully`, 'success');
  });

  // ---- Toast ----
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconSvg = type === 'success'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>'
      : type === 'error'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';

    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ---- KPI Counter Animation ----
  function animateCounters() {
    document.querySelectorAll('.kpi-value[data-target]').forEach(el => {
      const target = parseFloat(el.dataset.target);
      const suffix = el.dataset.suffix || '';
      const isFloat = target % 1 !== 0;
      const duration = 1200;
      const start = performance.now();

      function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = target * eased;
        el.textContent = (isFloat ? current.toFixed(1) : Math.round(current)) + suffix;
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // ---- Sparklines ----
  function renderSparklines() {
    document.querySelectorAll('.kpi-sparkline').forEach((container, i) => {
      const values = container.dataset.values.split(',').map(Number);
      const sparkColors = [COLORS.blue, COLORS.amber, COLORS.green, COLORS.purple];
      new Sparkline(container, values, sparkColors[i] || COLORS.blue);
    });
  }

  // ---- Process Table ----
  let currentFilter = 'all';

  function renderProcessTable() {
    const tbody = document.getElementById('processTableBody');
    const filtered = currentFilter === 'all'
      ? processes
      : processes.filter(p => p.status === currentFilter);

    tbody.innerHTML = filtered.slice(0, 10).map((p, i) => {
      const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
      return `
        <tr class="slide-up stagger-${Math.min(i + 1, 5)}">
          <td><span class="process-id">${p.id}</span></td>
          <td><strong>${p.name}</strong></td>
          <td>${p.department}</td>
          <td>
            <div class="process-owner">
              <div class="owner-avatar" style="background: ${avatarColor}">${getInitials(p.owner)}</div>
              ${p.owner}
            </div>
          </td>
          <td><span class="status-badge ${p.status}">${formatStatus(p.status)}</span></td>
          <td><span class="priority-badge ${p.priority}"><span class="priority-dot"></span>${capitalize(p.priority)}</span></td>
          <td>${formatDate(p.date)}</td>
          <td>
            <button class="action-btn" title="View" onclick="viewProcess('${p.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Table filter chips
  document.querySelectorAll('.filter-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderProcessTable();
    });
  });

  // ---- Process Grid (Processes Page) ----
  function renderProcessGrid() {
    const grid = document.getElementById('processGrid');
    grid.innerHTML = processes.map((p, i) => {
      const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
      const progressClass = p.progress >= 80 ? 'green' : p.progress >= 40 ? '' : p.progress >= 20 ? 'amber' : 'red';
      return `
        <div class="process-card slide-up stagger-${Math.min(i % 5 + 1, 5)}">
          <div class="process-card-header">
            <div>
              <div class="process-card-title">${p.name}</div>
              <div class="process-card-id">${p.id} &middot; ${p.department}</div>
            </div>
            <span class="status-badge ${p.status}">${formatStatus(p.status)}</span>
          </div>
          <div class="process-card-desc">${p.description}</div>
          <div class="progress-section">
            <div class="progress-header">
              <span class="progress-label">Completion</span>
              <span class="progress-value">${p.progress}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill ${progressClass}" style="width: 0%" data-width="${p.progress}%"></div>
            </div>
          </div>
          <div class="process-card-meta">
            <div class="process-card-footer">
              <div class="owner-avatar" style="background: ${avatarColor}; width:24px; height:24px; font-size:0.6rem;">${getInitials(p.owner)}</div>
              <span class="meta-tag">${p.owner}</span>
            </div>
            <div style="display:flex; gap:12px;">
              <span class="meta-tag">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                ${p.comments}
              </span>
              <span class="meta-tag">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
                ${p.completedSteps}/${p.steps}
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Animate progress bars
    setTimeout(() => {
      grid.querySelectorAll('.progress-fill').forEach(bar => {
        bar.style.width = bar.dataset.width;
      });
    }, 200);
  }

  // ---- Review Board (Kanban) ----
  function renderReviewBoard() {
    const columns = {
      pending: document.getElementById('pendingColumn'),
      'in-review': document.getElementById('reviewColumn'),
      approved: document.getElementById('approvedColumn'),
      rejected: document.getElementById('rejectedColumn'),
    };

    const counts = { pending: 0, 'in-review': 0, approved: 0, rejected: 0 };

    // Clear columns
    Object.values(columns).forEach(col => col.innerHTML = '');

    processes.forEach((p, i) => {
      counts[p.status]++;
      const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
      const card = document.createElement('div');
      card.className = 'review-card';
      card.innerHTML = `
        <div class="review-card-title">${p.name}</div>
        <span class="priority-badge ${p.priority}" style="font-size:0.75rem;">
          <span class="priority-dot"></span>${capitalize(p.priority)}
        </span>
        <div class="review-card-meta">
          <div class="review-card-assignee">
            <div class="avatar" style="background: ${avatarColor}">${getInitials(p.owner)}</div>
            ${p.owner}
          </div>
          <span class="review-card-date">${formatDate(p.date)}</span>
        </div>
      `;
      if (columns[p.status]) {
        columns[p.status].appendChild(card);
      }
    });

    document.getElementById('pendingCount').textContent = counts.pending;
    document.getElementById('reviewCount').textContent = counts['in-review'];
    document.getElementById('approvedCount').textContent = counts.approved;
    document.getElementById('rejectedCount').textContent = counts.rejected;
  }

  // ---- Activity Timeline ----
  function renderTimeline() {
    const timeline = document.getElementById('activityTimeline');
    timeline.innerHTML = ACTIVITY_TIMELINE.map(item => `
      <div class="timeline-item">
        <div class="timeline-icon ${item.type}">${getNotifIcon(item.icon)}</div>
        <div class="timeline-content">
          <div class="timeline-text">${item.text}</div>
          <div class="timeline-time">${formatDate(item.time)}</div>
        </div>
      </div>
    `).join('');
  }

  // ---- Leaderboard ----
  function renderLeaderboard() {
    const board = document.getElementById('leaderboard');
    const sorted = [...TEAM_MEMBERS].sort((a, b) => b.reviews - a.reviews);
    const maxReviews = sorted[0].reviews;

    board.innerHTML = sorted.slice(0, 5).map((m, i) => {
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'default';
      const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
      const pct = (m.reviews / maxReviews) * 100;
      return `
        <div class="leaderboard-item">
          <div class="leaderboard-rank ${rankClass}">${i + 1}</div>
          <div class="avatar" style="background: ${avatarColor}">${getInitials(m.name)}</div>
          <div class="leaderboard-info">
            <div class="leaderboard-name">${m.name}</div>
            <div class="leaderboard-dept">${m.dept}</div>
            <div class="leaderboard-bar">
              <div class="leaderboard-fill" style="width: ${pct}%"></div>
            </div>
          </div>
          <div class="leaderboard-stats">
            <div class="leaderboard-count">${m.reviews}</div>
            <div class="leaderboard-label">reviews</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ---- Team Grid ----
  function renderTeamGrid() {
    const grid = document.getElementById('teamGrid');
    grid.innerHTML = TEAM_MEMBERS.map((m, i) => {
      const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
      return `
        <div class="team-card slide-up stagger-${Math.min(i + 1, 5)}">
          <div class="team-avatar" style="background: ${avatarColor}">${getInitials(m.name)}</div>
          <div class="team-name">${m.name}</div>
          <div class="team-role">${m.role}</div>
          <div class="team-dept">${m.dept}</div>
          <div class="team-status ${m.status}">
            <span class="dot"></span>
            ${capitalize(m.status)}
          </div>
          <div class="team-stats">
            <div>
              <div class="team-stat-value">${m.reviews}</div>
              <div class="team-stat-label">Reviews</div>
            </div>
            <div>
              <div class="team-stat-value">${m.approved}</div>
              <div class="team-stat-label">Approved</div>
            </div>
            <div>
              <div class="team-stat-value">${m.avgTime}</div>
              <div class="team-stat-label">Avg Time</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ---- Dashboard Charts ----
  let dashboardCharts = {};

  function renderDashboardCharts() {
    // Activity Chart (Bar)
    const actCanvas = document.getElementById('activityChart');
    if (actCanvas) {
      dashboardCharts.activity = new BarChart(actCanvas, {
        labels: CHART_DATA.activityLabels,
        datasets: [
          { values: CHART_DATA.submitted, color: COLORS.blue, label: 'Submitted' },
          { values: CHART_DATA.approved, color: COLORS.green, label: 'Approved' },
          { values: CHART_DATA.rejected, color: COLORS.red, label: 'Rejected' },
        ],
      });
    }

    // Status Donut
    const statusCanvas = document.getElementById('statusChart');
    if (statusCanvas) {
      dashboardCharts.status = new DonutChart(statusCanvas, CHART_DATA.statusDistribution);

      // Render legend
      const legendEl = document.getElementById('statusLegend');
      legendEl.innerHTML = CHART_DATA.statusDistribution.labels.map((label, i) => `
        <div class="status-legend-item">
          <span class="dot" style="background: ${CHART_DATA.statusDistribution.colors[i]}"></span>
          <span>${label} (${CHART_DATA.statusDistribution.values[i]})</span>
        </div>
      `).join('');
    }
  }

  // ---- Analytics Charts ----
  function renderAnalyticsCharts() {
    // Cycle Time
    const ctCanvas = document.getElementById('cycleTimeChart');
    if (ctCanvas) {
      new LineChart(ctCanvas, {
        labels: CHART_DATA.cycleTime.labels,
        values: CHART_DATA.cycleTime.values,
        color: COLORS.green,
      });
    }

    // Department Reviews
    const deptCanvas = document.getElementById('deptChart');
    if (deptCanvas) {
      new HBarChart(deptCanvas, {
        labels: CHART_DATA.departmentReviews.labels,
        values: CHART_DATA.departmentReviews.values,
        colors: CHART_DATA.departmentReviews.colors,
      });
    }

    // Workload
    const workloadCanvas = document.getElementById('workloadChart');
    if (workloadCanvas) {
      new StackedBarChart(workloadCanvas, {
        labels: CHART_DATA.workload.labels,
        datasets: [
          { values: CHART_DATA.workload.active, color: COLORS.blue, label: 'Active' },
          { values: CHART_DATA.workload.completed, color: COLORS.green, label: 'Completed' },
        ],
      });
    }

    // Throughput
    const tpCanvas = document.getElementById('throughputChart');
    if (tpCanvas) {
      new LineChart(tpCanvas, {
        labels: CHART_DATA.throughput.labels,
        values: CHART_DATA.throughput.values,
        color: COLORS.purple,
      });
    }
  }

  // ---- Search ----
  globalSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      renderProcessTable();
      return;
    }
    const filtered = processes.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.id.toLowerCase().includes(query) ||
      p.owner.toLowerCase().includes(query) ||
      p.department.toLowerCase().includes(query)
    );

    const tbody = document.getElementById('processTableBody');
    tbody.innerHTML = filtered.slice(0, 10).map((p, i) => {
      const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
      return `
        <tr>
          <td><span class="process-id">${p.id}</span></td>
          <td><strong>${p.name}</strong></td>
          <td>${p.department}</td>
          <td>
            <div class="process-owner">
              <div class="owner-avatar" style="background: ${avatarColor}">${getInitials(p.owner)}</div>
              ${p.owner}
            </div>
          </td>
          <td><span class="status-badge ${p.status}">${formatStatus(p.status)}</span></td>
          <td><span class="priority-badge ${p.priority}"><span class="priority-dot"></span>${capitalize(p.priority)}</span></td>
          <td>${formatDate(p.date)}</td>
          <td>
            <button class="action-btn" title="View">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Navigate to dashboard to show search results
    navigateTo('dashboard');
  });

  // ---- Helpers ----
  function formatStatus(status) {
    const map = {
      'pending': 'Pending',
      'in-review': 'In Review',
      'approved': 'Approved',
      'rejected': 'Rejected',
    };
    return map[status] || status;
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Global view handler
  window.viewProcess = function (id) {
    const process = processes.find(p => p.id === id);
    if (process) {
      showToast(`Viewing ${process.name} (${process.id})`, 'info');
    }
  };

  // ---- Initialize ----
  function init() {
    animateCounters();
    renderSparklines();
    renderDashboardCharts();
    renderProcessTable();
    renderProcessGrid();
    renderReviewBoard();
    renderTimeline();
    renderLeaderboard();
    renderTeamGrid();
    renderNotifications();
  }

  // Intersection Observer for animations
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.kpi-card, .chart-card, .table-card, .card').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      observer.observe(el);
    });
  }

  // Run
  init();

})();
