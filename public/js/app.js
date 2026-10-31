/**
 * ITPE PROJECT — System Administration & Maintenance LMS
 * Main Application Controller v2.0 — Premium Redesigned UI
 */

const App = {
  adminId: 'TUPT-23-1096',
  state: {
    user: null,
    token: localStorage.getItem('itpe_token') || null,
    currentView: 'topics',
    selectedTopicId: null,
    activeTopicTab: 'lesson',
    subject: null,
    settings: { passingPercentage: 50 },
    topics: [],
    currentTopic: null,
    currentSlideIndex: 0
  },

  getLocalUsers() {
    localStorage.setItem('itpe_users', JSON.stringify([]));
    return [];
  },

  isFacultyUser(user = this.state.user) {
    return !!user && (
      user.role === 'faculty' ||
      String(user.idNumber || '').trim().toUpperCase() === this.adminId
    );
  },

  applyAdminRole(user) {
    if (user && String(user.idNumber || '').trim().toUpperCase() === this.adminId) {
      user.role = 'faculty';
    }
    return user;
  },

  escapeHtml(value) {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value ?? '').replace(/[&<>"']/g, character => entities[character]);
  },

  async init() {
    this.bindEvents();
    this.getLocalUsers();
    if (this.state.token) {
      await this.checkAuth();
    } else {
      this.renderAuth();
    }
  },

  async api(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.state.token ? { 'Authorization': `Bearer ${this.state.token}` } : {}),
      ...(options.headers || {})
    };
    try {
      const res = await fetch(endpoint, { ...options, headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Request failed');
      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      this.toast(err.message, 'danger');
      throw err;
    }
  },

  async checkAuth() {
    try {
      const res = await this.api('/api/auth/me');
      if (res.success && res.user) {
        this.state.user = this.applyAdminRole(res.user);
        localStorage.setItem('itpe_current_user', JSON.stringify(res.user));
        this.updateUserNav();
        await this.loadSubject();
        await this.loadTopics();
        this.navigate('topics');
      } else { this.logout(); }
    } catch (err) { this.logout(); }
  },

  updateUserNav() {
    const nav = document.getElementById('user-nav-area');
    if (!nav) return;
    if (!this.state.user) {
      nav.innerHTML = `<button class="btn btn-primary btn-sm" onclick="App.renderAuth()">Log In / Register</button>`;
      this.renderSidebarNav();
      return;
    }
    const fullName = `${this.state.user.firstName || ''} ${this.state.user.lastName || ''}`.trim();
    const initials = fullName.split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
    nav.innerHTML = `
      <div class="user-pill">
        <span class="user-avatar" aria-hidden="true">${this.escapeHtml(initials || 'U')}</span>
        <span class="user-pill-copy">
          <strong>${this.escapeHtml(fullName)}</strong>
          <span>${this.escapeHtml(this.state.user.idNumber || '')}</span>
        </span>
        <span class="role-badge ${this.isFacultyUser() ? 'faculty' : 'student'}">${this.isFacultyUser() ? 'Faculty' : 'Student'}</span>
      </div>
      <button class="btn btn-ghost btn-sm logout-button" onclick="App.logout()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        <span>Sign out</span>
      </button>
    `;
    this.renderSidebarNav();
  },

  renderSidebarNav() {
    const nav = document.getElementById('sidebar-nav');
    const sidebar = document.getElementById('app-sidebar');
    if (!nav || !sidebar) return;
    if (!this.state.user) {
      nav.innerHTML = '';
      return;
    }

    const isFaculty = this.isFacultyUser();
    const activeView = this.state.currentView;
    const modulesActive = ['topics', 'topic-detail', 'quiz'].includes(activeView);
    const reportActive = ['topic-report', 'master-report'].includes(activeView);
    nav.innerHTML = `
      <button type="button" class="sidebar-link ${modulesActive ? 'active' : ''}" onclick="App.navigate('topics')" ${modulesActive ? 'aria-current="page"' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M12 8h5M12 12h5M12 16h3"/></svg>
        <span>Course modules</span>
      </button>
      ${isFaculty ? `
        <button type="button" class="sidebar-link ${reportActive ? 'active' : ''}" onclick="App.navigate('master-report')" ${reportActive ? 'aria-current="page"' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 5-6"/><path d="M16 7h3v3"/></svg>
          <span>Gradebook</span>
        </button>
        <div class="sidebar-divider"></div>
        <div class="sidebar-section-label">Manage</div>
        <button type="button" class="sidebar-link" onclick="App.closeMobileSidebar();App.openSubjectModal()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.6 2.8-.2-.1a1.7 1.7 0 0 0-1.8.1l-.2.1h-3.2l-.1-.2a1.7 1.7 0 0 0-1.6-1l-.2.1-2.8-1.6.1-.2a1.7 1.7 0 0 0-.1-1.8l-.1-.2v-3.2l.2-.1a1.7 1.7 0 0 0 1-1.6l-.1-.2 1.6-2.8.2.1a1.7 1.7 0 0 0 1.8-.1l.2-.1h3.2l.1.2a1.7 1.7 0 0 0 1.6 1l.2-.1 2.8 1.6-.1.2a1.7 1.7 0 0 0 .1 1.8l.1.2V15z"/></svg>
          <span>Course settings</span>
        </button>
      ` : ''}
    `;

    const heading = document.getElementById('workspace-title');
    if (heading) {
      const titles = {
        topics: 'Course modules',
        'topic-detail': 'Module overview',
        quiz: 'Assessment',
        'topic-report': 'Topic report',
        'master-report': 'Gradebook'
      };
      heading.textContent = titles[activeView] || 'Course modules';
    }
  },

  toggleMobileSidebar(button) {
    const sidebar = document.getElementById('app-sidebar');
    if (!sidebar || !button) return;
    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    sidebar.classList.toggle('mobile-nav-open', !isExpanded);
    button.setAttribute('aria-expanded', String(!isExpanded));
  },

  closeMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const button = sidebar?.querySelector('.sidebar-mobile-toggle');
    sidebar?.classList.remove('mobile-nav-open');
    button?.setAttribute('aria-expanded', 'false');
  },

  toggleLandingMenu(button) {
    const links = document.getElementById('landing-navigation');
    if (!links || !button) return;
    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    links.classList.toggle('is-open', !isExpanded);
    button.setAttribute('aria-expanded', String(!isExpanded));
    button.setAttribute('aria-label', isExpanded ? 'Open navigation menu' : 'Close navigation menu');
  },

  closeLandingMenu() {
    const links = document.getElementById('landing-navigation');
    const button = document.querySelector('.landing-menu-toggle');
    links?.classList.remove('is-open');
    button?.setAttribute('aria-expanded', 'false');
    button?.setAttribute('aria-label', 'Open navigation menu');
  },

  async loadSubject() {
    try {
      const res = await this.api('/api/subject');
      if (res.success) { this.state.subject = res.subject; this.state.settings = res.settings || { passingPercentage: 50 }; this.renderSubjectBanner(); }
    } catch (e) {}
  },

  renderSubjectBanner() {
    const banner = document.getElementById('subject-banner-area');
    if (!this.state.subject || !banner) return;
    const s = this.state.subject;
    const isFaculty = this.isFacultyUser();
    banner.innerHTML = `
      <div class="subject-banner">
        <div class="subject-info">
          <h2>${s.name}</h2>
          <div class="subject-meta">
            <span><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>${s.code}</span>
            <span><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${s.term}</span>
            <span><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>${s.yearLevel}</span>
          </div>
        </div>
        <div class="subject-actions">
          ${isFaculty ? `
            <button class="btn btn-primary btn-sm" onclick="Faculty.openNewTopicModal()">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              Upload Topic
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Faculty.openQuizUploadModal()">Upload Quiz</button>
            <button class="btn btn-secondary btn-sm" onclick="App.openSubjectModal()">Edit Details</button>
          ` : `<span class="topic-status-badge in-progress">
            <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/></svg>
            Enrolled Student
          </span>`}
        </div>
      </div>
    `;
  },

  async loadTopics() {
    try {
      const res = await this.api('/api/topics');
      if (res.success) {
        this.state.topics = res.topics;
        if (this.state.currentView === 'topics') this.renderTopicsView();
      }
    } catch (e) { console.error(e); }
  },

  navigate(view, topicId = null) {
    this.closeMobileSidebar();
    window.PatternWaves?.stop();
    document.body.classList.remove('pattern-login');
    window.MicroSlats?.start();
    document.body.classList.add('portal-view');
    document.body.classList.remove('registration-view');
    if (this.state.currentView === 'quiz' && view !== 'quiz') {
      clearInterval(Quiz.state.timerInterval);
    }
    this.state.currentView = view;
    if (topicId) this.state.selectedTopicId = topicId;
    this.renderSidebarNav();

    document.querySelector('.top-nav').style.display = '';
    document.querySelector('.main-wrapper').classList.remove('landing-mode');
    document.body.classList.remove('landing-body');

    const main = document.getElementById('main-content');
    main.innerHTML = '';
    main.style.userSelect = '';
    main.style.webkitUserSelect = '';
    main.classList.remove('quiz-no-copy');
    main.oncopy = null;
    main.oncut = null;
    main.oncontextmenu = null;
    main.onkeydown = null;

    if (view === 'topics')           { this.loadTopics(); }
    else if (view === 'topic-detail'){ this.loadTopicDetail(topicId); }
    else if (view === 'quiz')        { Quiz.start(topicId); }
    else if (view === 'topic-report'){ Reports.renderTopicReport(topicId); }
    else if (view === 'master-report'){ Reports.renderMasterReport(); }
  },

  renderTopicsView() {
    const main = document.getElementById('main-content');
    const isFaculty = this.isFacultyUser();
    const topics = this.state.topics;
    const completedTopics = topics.filter(topic => topic.status === 'completed').length;
    const availableTopics = topics.filter(topic => !topic.isLocked && topic.status !== 'completed').length;
    const lockedTopics = topics.filter(topic => topic.isLocked && topic.status !== 'completed').length;
    const readyTopics = availableTopics;
    const questionCount = topics.reduce((total, topic) => total + (Number(topic.questionCount) || 0), 0);
    const progressPercent = topics.length ? Math.round(completedTopics / topics.length * 100) : 0;
    const completedPercent = topics.length ? completedTopics / topics.length * 100 : 0;
    const readyPercent = topics.length ? readyTopics / topics.length * 100 : 0;
    const lockedPercent = topics.length ? lockedTopics / topics.length * 100 : 0;

    let html = `
      <section class="dashboard-overview" aria-label="Course progress overview">
        <div class="dashboard-welcome">
          <div>
            <span class="dashboard-kicker">${isFaculty ? 'FACULTY WORKSPACE' : 'YOUR LEARNING SPACE'}</span>
            <h2>${isFaculty ? 'Course at a glance' : `Welcome back, ${this.escapeHtml(this.state.user?.firstName || 'learner')}`}</h2>
            <p>${isFaculty ? 'Manage course content and monitor assessment readiness.' : 'Keep moving through your modules and build your system administration skills.'}</p>
          </div>
          <div class="dashboard-welcome-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48"><path d="M8 34V14a3 3 0 0 1 3-3h26a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3Z"/><path d="M16 19h16M16 25h10M16 31h7"/></svg>
          </div>
        </div>
        <div class="dashboard-stats">
          <article class="stat-card">
            <span class="stat-icon stat-icon-blue" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16M8 7h8M8 11h8"/></svg>
            </span>
            <span class="stat-label">Course modules</span>
            <strong>${topics.length}</strong>
            <span class="stat-caption">${topics.length === 1 ? 'module published' : 'modules published'}</span>
          </article>
          ${isFaculty ? `
            <article class="stat-card">
              <span class="stat-icon stat-icon-violet" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>
              </span>
              <span class="stat-label">Quiz questions</span>
              <strong>${questionCount}</strong>
              <span class="stat-caption">across all modules</span>
            </article>
            <article class="stat-card stat-card-progress">
              <span class="stat-icon stat-icon-amber" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 3v3M5.64 5.64l2.12 2.12M3 12h3M5.64 18.36l2.12-2.12M12 18v3M18.36 18.36l-2.12-2.12M18 12h3M18.36 5.64l-2.12 2.12"/><circle cx="12" cy="12" r="4"/></svg>
              </span>
              <span class="stat-label">Passing standard</span>
              <strong>${this.state.settings?.passingPercentage || 50}%</strong>
              <span class="stat-caption">minimum score to pass</span>
            </article>
          ` : `
            <article class="stat-card">
              <span class="stat-icon stat-icon-green" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>
              </span>
              <span class="stat-label">Modules completed</span>
              <strong>${completedTopics}<small> / ${topics.length}</small></strong>
              <span class="stat-caption">${progressPercent}% of your course</span>
            </article>
            <article class="stat-card stat-card-progress">
              <span class="stat-icon stat-icon-amber" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 3v3M5.64 5.64l2.12 2.12M3 12h3M5.64 18.36l2.12-2.12M12 18v3M18.36 18.36l-2.12-2.12M18 12h3M18.36 5.64l-2.12 2.12"/><circle cx="12" cy="12" r="4"/></svg>
              </span>
              <span class="stat-label">Ready to learn</span>
              <strong>${availableTopics}</strong>
              <span class="stat-caption">unlocked modules</span>
            </article>
          `}
        </div>
        ${!isFaculty ? `<section class="dashboard-status-chart" aria-label="Module status overview">
          <div class="dashboard-chart-heading">
            <div>
              <strong>Progress by module</strong>
              <span>A quick view of your course journey</span>
            </div>
            <span class="dashboard-chart-total">${topics.length} total</span>
          </div>
          <div class="dashboard-stack-chart" role="img" aria-label="${completedTopics} completed, ${readyTopics} available, ${lockedTopics} locked">
            <span class="chart-segment chart-completed" style="width:${completedPercent}%"></span>
            <span class="chart-segment chart-ready" style="width:${readyPercent}%"></span>
            <span class="chart-segment chart-locked" style="width:${lockedPercent}%"></span>
          </div>
          <div class="dashboard-chart-legend">
            <span><i class="legend-completed"></i>Completed <strong>${completedTopics}</strong></span>
            <span><i class="legend-ready"></i>Available <strong>${readyTopics}</strong></span>
            <span><i class="legend-locked"></i>Locked <strong>${lockedTopics}</strong></span>
          </div>
        </section>` : ''}
      </section>
      <div class="card" style="animation-delay:0s">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:0.75rem">
          <div>
            <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.25rem">
              <div class="module-heading-accent"></div>
              <h2 class="module-section-title">Course Modules</h2>
              <span class="topic-status-badge in-progress">${topics.length} Topics</span>
            </div>
            <p class="module-section-description">
              ${isFaculty ? 'Faculty portal — manage topics, upload materials, configure quizzes.' : `Sequential learning — pass ${this.state.settings?.passingPercentage || 50}% to unlock the next module.`}
            </p>
          </div>
          <div style="display:flex;gap:0.5rem">
            ${isFaculty ? `<button class="btn btn-secondary btn-sm" onclick="App.navigate('master-report')">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              Gradebook
            </button>` : ''}
            ${isFaculty ? `<button class="btn btn-primary btn-sm" onclick="Faculty.openNewTopicModal()">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              Upload Topic
            </button><button class="btn btn-secondary btn-sm" onclick="Faculty.openQuizUploadModal()">Upload Quiz</button>` : ''}
          </div>
        </div>
    `;

    if (topics.length === 0) {
      if (isFaculty) {
        html += `
          <div class="empty-curriculum-state">
            <div style="width:70px;height:70px;margin:0 auto 1.25rem;border-radius:18px;background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(6,182,212,0.1));border:1px solid rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;font-size:1.8rem">📐</div>
            <h3 class="empty-curriculum-title">Curriculum is Empty</h3>
            <p class="empty-curriculum-copy">
              Upload your first topic — lecture notes, slides, or even a <strong style="color:#a5b4fc">photo of your lecture material</strong>. 
              Upload course materials to prepare a topic. The admin can use its generated quiz or upload a separate quiz file.
            </p>
            <button class="btn btn-primary empty-curriculum-primary" onclick="Faculty.openNewTopicModal()">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              Upload Topic
            </button>
            <button class="btn btn-secondary empty-curriculum-secondary" onclick="Faculty.openQuizUploadModal()">Upload Quiz</button>
          </div>
        `;
      } else {
        html += `
          <div class="empty-curriculum-state empty-curriculum-state--student">
            <div style="width:70px;height:70px;margin:0 auto 1.25rem;border-radius:18px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;font-size:1.8rem">⏳</div>
            <h3 class="empty-curriculum-title">No Modules Published Yet</h3>
            <p class="empty-curriculum-copy">
              Your instructor hasn't uploaded any course modules yet. They'll appear here once published — check back soon!
            </p>
          </div>
        `;
      }
    } else {
      html += `<div class="toc-grid">`;
      topics.forEach((t, i) => {
        let statusBadge = '';
        let actionButtons = '';

        if (isFaculty) {
          statusBadge = `<span class="topic-status-badge in-progress">${t.questionCount} Qs</span>`;
          actionButtons = `
            <button class="btn btn-primary btn-sm" onclick="App.navigate('topic-detail','${t.id}')">Open</button>
            <button class="btn btn-secondary btn-sm" onclick="Faculty.openQuizManager('${t.id}')">Quiz Editor</button>
            <button class="btn btn-outline btn-sm" onclick="Faculty.openBulkImportModal('${t.id}')" title="Upload a quiz file">Upload Quiz</button>
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('topic-report','${t.id}')">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            </button>
            <button class="btn btn-danger btn-sm" title="Delete topic" aria-label="Delete topic" onclick="Faculty.deleteTopic('${t.id}','${t.title.replace(/'/g,"\\'")}')">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              Delete
            </button>
          `;
        } else {
          if (t.isLocked) {
            statusBadge = `<span class="topic-status-badge locked">🔒 Locked</span>`;
            actionButtons = `<button class="btn btn-secondary btn-sm" disabled>🔒 Locked</button>`;
          } else if (t.status === 'completed') {
            statusBadge = `<span class="topic-status-badge completed">✅ ${t.bestScore}/${t.totalQuestions}</span>`;
            actionButtons = `
              <button class="btn btn-secondary btn-sm" onclick="App.navigate('topic-detail','${t.id}')">Review</button>
              <button class="btn btn-success btn-sm" onclick="App.navigate('quiz','${t.id}')">Retake Quiz</button>
            `;
          } else if (t.status === 'failed') {
            statusBadge = `<span class="topic-status-badge failed">❌ Failed</span>`;
            actionButtons = `
              <button class="btn btn-danger btn-sm" onclick="App.navigate('topic-detail','${t.id}')">Review First</button>
              <button class="btn btn-primary btn-sm" onclick="App.navigate('quiz','${t.id}')">Retake Quiz</button>
            `;
          } else {
            statusBadge = `<span class="topic-status-badge in-progress">⏳ Unlocked</span>`;
            actionButtons = `
              <button class="btn btn-primary btn-sm" onclick="App.navigate('topic-detail','${t.id}')">Open Lesson</button>
              <button class="btn btn-accent btn-sm" onclick="App.navigate('quiz','${t.id}')">Take Quiz</button>
            `;
          }
        }

        html += `
          <div class="topic-card ${t.isLocked && !isFaculty ? 'locked' : ''}" style="animation-delay:${i * 0.05}s">
            <div class="topic-header">
              <div style="flex:1;min-width:0">
                <div class="topic-number">Module ${t.order}</div>
                <h3 class="topic-title">${t.title}</h3>
              </div>
              ${statusBadge}
            </div>
            <div class="topic-card-body">
              <p>System administration lessons, maintenance guides, interactive slide decks, and timed mastery quizzes.</p>
            </div>
            <div class="topic-card-footer">
              ${actionButtons}
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }
    html += `</div>`;
    main.innerHTML = html;
  },

  async loadTopicDetail(topicId) {
    try {
      const res = await this.api(`/api/topics/${topicId}`);
      if (res.success) { this.state.currentTopic = res.topic; this.renderTopicDetailView(); }
    } catch (e) {
      if (e.message && e.message.includes('locked')) {
        this.toast(`Topic locked — pass the previous quiz with ${this.state.settings?.passingPercentage || 50}% first!`, 'warning');
        this.navigate('topics');
      }
    }
  },

  renderTopicDetailView() {
    const main = document.getElementById('main-content');
    const t = this.state.currentTopic;
    const isFaculty = this.isFacultyUser();
    const activeTab = this.state.activeTopicTab;

    let contentHtml = '';

    if (activeTab === 'lesson') {
      contentHtml = `
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:1.5rem;line-height:1.8">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
            <h3 style="font-size:1.1rem;font-weight:700;color:#f0f2ff;display:flex;align-items:center;gap:0.5rem">
              <span style="width:28px;height:28px;border-radius:8px;background:rgba(99,102,241,0.2);display:inline-flex;align-items:center;justify-content:center;font-size:0.85rem">📝</span>
              Lesson Notes & Administration Procedures
            </h3>
            ${isFaculty ? `<button class="btn btn-secondary btn-sm" onclick="Faculty.openLessonEditor()">✏️ Edit</button>` : ''}
          </div>
          <div class="lesson-content-body">${t.lessonText || '<p style="color:rgba(165,180,252,0.4)">No lecture text yet. Faculty can add content here.</p>'}</div>
        </div>
      `;
    } else if (activeTab === 'presentation') {
      const pres = t.presentation;
      contentHtml = `
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:1.5rem">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
            <h3 style="font-size:1.1rem;font-weight:700;color:#f0f2ff;display:flex;align-items:center;gap:0.5rem">
              <span style="width:28px;height:28px;border-radius:8px;background:rgba(6,182,212,0.15);display:inline-flex;align-items:center;justify-content:center;font-size:0.85rem">📂</span>
              Uploaded Material / Presentation
            </h3>
            ${isFaculty ? `<button class="btn btn-primary btn-sm" onclick="Faculty.openUploadModal()">📤 Upload New</button>` : ''}
          </div>
          ${pres && (pres.fileUrl || pres.title) ? `
            <div style="background:rgba(0,0,0,0.2);border:1px dashed rgba(255,255,255,0.1);border-radius:14px;padding:1.5rem;text-align:center">
              ${(pres.fileUrl && /\.(png|jpe?g|webp|gif)$/i.test(pres.fileUrl)) ? `
                <div style="margin-bottom:1.25rem">
                  <img src="${pres.fileUrl}" alt="${pres.title || 'Material'}" style="max-height:380px;max-width:100%;object-fit:contain;border-radius:10px;border:1px solid rgba(255,255,255,0.1);box-shadow:0 8px 30px rgba(0,0,0,0.4)" />
                </div>
              ` : `<div style="font-size:3rem;margin-bottom:0.75rem">📊</div>`}
              <h4 style="font-size:1rem;font-weight:700;color:#f0f2ff;margin-bottom:0.5rem">${pres.title || 'Course Presentation'}</h4>
              <p style="font-size:0.82rem;color:rgba(165,180,252,0.5);margin-bottom:1.25rem">${pres.fileUrl ? 'Official material attached by faculty.' : 'Reference: ' + pres.title}</p>
              ${pres.fileUrl ? `<a href="${pres.fileUrl}" target="_blank" download class="btn btn-primary">⬇️ Download Material</a>` : `<span class="btn btn-secondary" style="cursor:default">Curriculum Archive</span>`}
            </div>
          ` : `
            <div style="text-align:center;padding:3rem;color:rgba(165,180,252,0.4)">
              <div style="font-size:2.5rem;margin-bottom:0.75rem">📂</div>
              <p>No presentation file has been uploaded yet.</p>
              ${isFaculty ? `<button class="btn btn-primary btn-sm" style="margin-top:1rem" onclick="Faculty.openUploadModal()">Upload File</button>` : ''}
            </div>
          `}
        </div>
      `;
    } else if (activeTab === 'slides') {
      const slides = t.slides && t.slides.length > 0 ? t.slides : [
        { title: "No Slides Created Yet", content: "Faculty can use the Slide Deck Builder to add interactive presentation cards for students." }
      ];
      const curIndex = Math.min(this.state.currentSlideIndex, slides.length - 1);
      const slide = slides[curIndex];
      const progress = ((curIndex + 1) / slides.length * 100).toFixed(0);

      contentHtml = `
        <div style="margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
          <h3 style="font-size:1.1rem;font-weight:700;color:#f0f2ff;display:flex;align-items:center;gap:0.5rem">
            <span style="width:28px;height:28px;border-radius:8px;background:rgba(99,102,241,0.2);display:inline-flex;align-items:center;justify-content:center;font-size:0.85rem">🖥️</span>
            Interactive Slide Deck
          </h3>
          ${isFaculty ? `<button class="btn btn-secondary btn-sm" onclick="Faculty.openSlideMaker()">✏️ Edit Slides</button>` : ''}
        </div>
        <div class="slide-deck">
          <div>
            <div style="font-size:0.7rem;font-weight:700;color:rgba(165,180,252,0.4);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.75rem">Slide ${curIndex + 1} of ${slides.length}</div>
            <div class="slide-content">
              <h3>${slide.title}</h3>
              <pre>${slide.content}</pre>
            </div>
          </div>
          <div>
            <div style="height:3px;background:rgba(255,255,255,0.05);border-radius:9999px;margin-bottom:1.25rem;overflow:hidden">
              <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,#6366f1,#06b6d4);border-radius:9999px;transition:width 0.4s ease"></div>
            </div>
            <div class="slide-controls">
              <button class="btn btn-secondary btn-sm" onclick="App.prevSlide()" ${curIndex === 0 ? 'disabled' : ''}>← Prev</button>
              <span class="slide-counter">${curIndex + 1} / ${slides.length}</span>
              <button class="btn btn-primary btn-sm" onclick="App.nextSlide()" ${curIndex === slides.length - 1 ? 'disabled' : ''}>Next →</button>
            </div>
          </div>
        </div>
      `;
    } else if (activeTab === 'summary') {
      contentHtml = `
        <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:1.5rem;line-height:1.8">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
            <h3 style="font-size:1.1rem;font-weight:700;color:#f0f2ff;display:flex;align-items:center;gap:0.5rem">
              <span style="width:28px;height:28px;border-radius:8px;background:rgba(16,185,129,0.15);display:inline-flex;align-items:center;justify-content:center;font-size:0.85rem">📌</span>
              Topic Summary & Key Takeaways
            </h3>
            ${isFaculty ? `<button class="btn btn-secondary btn-sm" onclick="Faculty.openSummaryEditor()">✏️ Edit</button>` : ''}
          </div>
          <div class="topic-summary-body">${t.summary || '<p style="color:rgba(165,180,252,0.4)">No summary provided yet.</p>'}</div>
          <div style="margin-top:2rem;padding:1.35rem;background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(6,182,212,0.08));border-radius:14px;border:1px solid rgba(99,102,241,0.25);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem">
            <div>
              <h4 style="font-weight:700;color:#a5b4fc;margin-bottom:0.25rem">Ready for the Topic Assessment?</h4>
              <p style="font-size:0.82rem;color:rgba(165,180,252,0.6)">10-minute timer · ${t.quizSettings?.passingPercentage || 50}% passing threshold · Strict gating — pass to unlock the next module.</p>
            </div>
            <button class="btn btn-accent btn-lg" onclick="App.navigate('quiz','${t.id}')">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Start Quiz Now
            </button>
          </div>
        </div>
      `;
    }

    main.innerHTML = `
      <div class="module-page-shell">
        <div class="module-page-toolbar">
          <button class="btn btn-secondary btn-sm" onclick="App.navigate('topics')">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            All Modules
          </button>
          <div class="module-page-actions">
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('topic-report','${t.id}')">📊 Summary</button>
            <button class="btn btn-accent btn-sm" onclick="App.navigate('quiz','${t.id}')">🎯 Take Quiz</button>
          </div>
        </div>

        <section class="module-feature-panel">
          <div class="module-feature-copy">
            <span class="module-feature-kicker">LEARNING UNIT <i></i> ${t.order}</span>
            <h2>${this.escapeHtml(t.title)}</h2>
            <p>Explore the lesson, course materials, interactive slides, and key takeaways for this module.</p>
            <div class="module-feature-tags">
              <span><i class="feature-tag-blue"></i>Guided lesson</span>
              <span><i class="feature-tag-teal"></i>Knowledge check</span>
              ${isFaculty ? '<span><i class="feature-tag-violet"></i>Faculty tools enabled</span>' : ''}
            </div>
          </div>
          <div class="module-feature-art" aria-hidden="true">
            <svg viewBox="0 0 180 150">
              <path class="feature-orbit orbit-outer" d="M90 13a62 62 0 1 1 0 124 62 62 0 0 1 0-124Z"/>
              <path class="feature-orbit orbit-inner" d="M90 29a46 46 0 1 1 0 92 46 46 0 0 1 0-92Z"/>
              <path class="feature-circuit" d="M21 75h26m86 0h26M90 3v22m0 100v22M42 27l16 16m64 64 16 16m0-96-16 16m-64 64-16 16"/>
              <rect class="feature-chip" x="65" y="50" width="50" height="50" rx="13"/>
              <path class="feature-chip-mark" d="M78 64h24v22H78zM83 70h14m-14 7h10"/>
              <circle class="feature-node node-one" cx="24" cy="75" r="4"/>
              <circle class="feature-node node-two" cx="155" cy="37" r="4"/>
              <circle class="feature-node node-three" cx="139" cy="126" r="4"/>
            </svg>
          </div>
        </section>

        <div class="card module-workbench-card">
          <div class="module-workbench-heading">
            <div>
              <span class="module-workbench-kicker">MODULE WORKSPACE</span>
              <h3>Learning resources</h3>
            </div>
            <span class="module-resource-count">04 <span>resources</span></span>
          </div>
          <div class="tabs">
          <button class="tab-btn ${activeTab === 'lesson' ? 'active' : ''}" onclick="App.setTopicTab('lesson')">
            📖 Lesson Notes
          </button>
          <button class="tab-btn ${activeTab === 'presentation' ? 'active' : ''}" onclick="App.setTopicTab('presentation')">
            📁 Material Upload
          </button>
          <button class="tab-btn ${activeTab === 'slides' ? 'active' : ''}" onclick="App.setTopicTab('slides')">
            🖥️ Slide Deck
          </button>
          <button class="tab-btn ${activeTab === 'summary' ? 'active' : ''}" onclick="App.setTopicTab('summary')">
            📌 Summary
          </button>
        </div>

        <div id="topic-tab-content" style="animation:fadeInUp 0.3s ease both">
          ${contentHtml}
        </div>
        </div>
      </div>
    `;
  },

  setTopicTab(tab) {
    this.state.activeTopicTab = tab;
    this.renderTopicDetailView();
  },

  nextSlide() {
    const slides = this.state.currentTopic.slides || [];
    if (this.state.currentSlideIndex < slides.length - 1) {
      this.state.currentSlideIndex++;
      this.renderTopicDetailView();
    }
  },

  prevSlide() {
    if (this.state.currentSlideIndex > 0) {
      this.state.currentSlideIndex--;
      this.renderTopicDetailView();
    }
  },

  renderAuth(mode = 'login') {
    window.PatternWaves?.stop();
    document.body.classList.toggle('pattern-login', mode === 'login');
    if (mode === 'login') window.MicroSlats?.stop();
    else window.MicroSlats?.start();
    document.body.classList.remove('portal-view');
    document.body.classList.toggle('registration-view', mode === 'register');
    const main = document.getElementById('main-content');
    const banner = document.getElementById('subject-banner-area');
    if (banner) banner.innerHTML = '';

    document.querySelector('.top-nav').style.display = 'none';
    document.querySelector('.main-wrapper').classList.add('landing-mode');
    document.body.classList.add('landing-body');

    main.innerHTML = `
      <div class="landing-page-root ${mode === 'login' ? 'security-auth-root' : ''}">
        <!-- Animated background mesh -->
        <div class="landing-bg-mesh"></div>
        ${mode === 'login' ? `
          <div class="security-hud security-hud-top-left" aria-hidden="true"><span>[ SYSTEM ]</span><br>&gt; Initializing secure connection...<br>&gt; Access level: Student / Faculty<span class="security-caret"></span></div>
          <div class="security-hud security-hud-top-right" aria-hidden="true"><i></i> SECURE CONNECTION</div>
          <div class="security-hud security-hud-bottom-right" aria-hidden="true">&gt; Verifying credentials...<br>&gt; Establishing session...<br>&gt; Ready.</div>
          <div class="security-version" aria-hidden="true">ITPE • SYSTEM ADMINISTRATION</div>
        ` : ''}

        <!-- Navigation -->
        <nav class="landing-nav" aria-label="Landing page navigation">
          <div class="landing-nav-inner">
            <div class="landing-brand">
              <div class="landing-brand-icon" aria-hidden="true">🖥️</div>
              <span class="landing-brand-text">System Administration &amp; Maintenance</span>
            </div>
            <div class="landing-nav-actions">
              <div class="landing-nav-links" id="landing-navigation">
                <a href="#" class="landing-link active" onclick="event.preventDefault();App.closeLandingMenu()">Home</a>
                <a href="#" class="landing-link" onclick="event.preventDefault();App.closeLandingMenu()">Learn</a>
                <a href="#" class="landing-link" onclick="event.preventDefault();App.closeLandingMenu()">Features</a>
                <button class="btn btn-secondary btn-sm landing-register-btn" onclick="App.closeLandingMenu();App.renderAuth('register')">Register</button>
              </div>
              <button class="btn btn-primary btn-sm landing-login-btn" onclick="App.closeLandingMenu();App.renderAuth('login')" aria-label="Go to login">Login</button>
              <button
                type="button"
                class="landing-menu-toggle"
                aria-controls="landing-navigation"
                aria-expanded="false"
                aria-label="Open navigation menu"
                onclick="App.toggleLandingMenu(this)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path class="menu-icon-lines" d="M4 6h16M4 12h16M4 18h16"/>
                  <path class="menu-icon-close" d="m6 6 12 12M18 6 6 18"/>
                </svg>
              </button>
            </div>
          </div>
        </nav>

        <!-- Hero Section -->
        <div class="landing-hero">
          <div class="landing-hero-inner">
            <!-- Left column -->
            <div class="landing-left">
              <p class="landing-tagline">LEARN &nbsp;•&nbsp; PRACTICE &nbsp;•&nbsp; MASTER</p>
              <h1 class="landing-title">System Admin<br><span>&amp; Maintenance</span></h1>
              <p class="landing-desc">Build practical skills in system administration and maintenance with clear lessons, interactive exercises, OCR-assisted quizzes, and real-world troubleshooting.</p>

              <div class="landing-features">
                <div class="landing-feature-item">
                  <div class="landing-feature-icon">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                  </div>
                  <span>Step-by-Step<br>Lessons</span>
                </div>
                <div class="landing-feature-item">
                  <div class="landing-feature-icon">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                  </div>
                  <span>Interactive<br>Exercises</span>
                </div>
                <div class="landing-feature-item">
                  <div class="landing-feature-icon">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                  </div>
                  <span>Track Your<br>Progress</span>
                </div>
              </div>

              <!-- Floating illustration -->
              <div class="landing-illustration system-admin-art" aria-hidden="true">
                <div class="system-server-rack">
                  <div class="system-server-unit"><span></span><span></span><i></i></div>
                  <div class="system-server-unit"><span></span><span></span><i></i></div>
                  <div class="system-server-unit"><span></span><span></span><i></i></div>
                </div>
                <div class="system-monitor">
                  <div class="system-monitor-top"><i></i><i></i><i></i><span>ADMIN CONSOLE</span></div>
                  <div class="system-terminal-line short"></div>
                  <div class="system-terminal-line"></div>
                  <div class="system-terminal-line medium"></div>
                  <div class="system-terminal-status"><span></span> SYSTEM ONLINE</div>
                </div>
                <div class="system-network-node node-a"></div>
                <div class="system-network-node node-b"></div>
              </div>
            </div>

            <!-- Right column: Auth Card -->
            <div class="landing-right">
              <div class="landing-auth-card" id="landing-auth-card">
                ${mode === 'login' ? this.getLandingLoginHtml() : this.getLandingRegisterHtml()}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    if (mode === 'login') window.PatternWaves?.start();
  },

  getLandingLoginHtml() {
    return `
      <div class="security-shield" aria-hidden="true">
        <svg width="58" height="66" viewBox="0 0 58 66" fill="none"><path d="M29 3L52 12V29C52 44 42 55 29 62C16 55 6 44 6 29V12L29 3Z" stroke="currentColor" stroke-width="3"/><rect x="21" y="28" width="16" height="14" rx="2" fill="currentColor"/><path d="M24 28V23a5 5 0 0110 0v5" stroke="currentColor" stroke-width="3"/><circle cx="29" cy="34" r="2" fill="#09090b"/></svg>
      </div>
      <h2 class="auth-card-title">SYSTEM ADMINISTRATION</h2>
      <p class="security-card-subtitle"><span></span>&amp; MAINTENANCE<span></span></p>
      <p class="auth-card-subtitle">Sign in to access the learning materials</p>

      <form onsubmit="App.handleLogin(event)">
        <div class="auth-field-group">
          <label class="auth-label">Student / Faculty ID</label>
          <div class="auth-input-wrap">
            <span class="auth-input-icon">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </span>
            <input type="text" id="login-idnumber" class="auth-input" required placeholder="TUPT-23-1096" autocapitalize="characters" oninput="this.value=this.value.toUpperCase()" />
          </div>
        </div>

        <div class="auth-field-group">
          <label class="auth-label">Password</label>
          <div class="auth-input-wrap">
            <span class="auth-input-icon">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            </span>
            <input type="password" id="login-password" class="auth-input" required placeholder="Enter your password" />
            <button type="button" class="auth-eye-btn" onclick="App.togglePassword('login-password', this)" tabindex="-1">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>

        <button type="submit" class="auth-btn-primary"><span aria-hidden="true">↪</span> Login</button>
      </form>

      <div class="security-card-separator"><span>///</span></div>
      <p class="auth-footer-text">Need an account? <a href="#" onclick="App.renderAuth('register');event.preventDefault()">Register</a></p>
    `;
  },

  getLandingRegisterHtml() {
    return `
      <h2 class="auth-card-title">Create Account</h2>
      <p class="auth-card-subtitle">Register to start learning System Administration and Maintenance.</p>

      <form onsubmit="App.handleRegister(event)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.65rem">
          <div class="auth-field-group">
            <label class="auth-label">First Name</label>
            <div class="auth-input-wrap">
              <input type="text" id="reg-firstname" class="auth-input" required placeholder="Juan" style="padding-left:0.85rem" />
            </div>
          </div>
          <div class="auth-field-group">
            <label class="auth-label">Last Name</label>
            <div class="auth-input-wrap">
              <input type="text" id="reg-lastname" class="auth-input" required placeholder="Dela Cruz" style="padding-left:0.85rem" />
            </div>
          </div>
        </div>

        <div class="auth-field-group">
          <label class="auth-label">Student / Faculty ID</label>
          <div class="auth-input-wrap">
            <span class="auth-input-icon">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </span>
            <input type="text" id="reg-idnumber" class="auth-input" required placeholder="TUPT-23-1096" autocapitalize="characters" oninput="this.value=this.value.toUpperCase()" />
          </div>
        </div>

        <div class="auth-field-group">
          <label class="auth-label">Password</label>
          <div class="auth-input-wrap">
            <input type="password" id="reg-password" class="auth-input" required placeholder="Create password" style="padding-left:0.85rem" />
          </div>
        </div>

        <div class="auth-field-group" style="background:rgba(99,102,241,0.06);padding:0.75rem;border-radius:10px;border:1px solid rgba(99,102,241,0.2)">
          <label style="display:flex;align-items:flex-start;gap:0.5rem;font-size:0.78rem;cursor:pointer;color:rgba(165,180,252,0.7)">
            <input type="checkbox" id="reg-privacy" required style="margin-top:2px;accent-color:#6366f1" />
            <span>I agree to the <a href="#" onclick="App.openPrivacyModal(event)" style="color:#6366f1;font-weight:700;text-decoration:underline">Data Privacy Policy</a> (R.A. 10173).</span>
          </label>
        </div>

        <button type="submit" class="auth-btn-primary">Complete Registration</button>
      </form>

      <div class="auth-divider"><span>OR</span></div>
      <button type="button" class="auth-btn-outline" onclick="App.renderAuth('login')">Back to Log In</button>
      <p class="auth-footer-text">Already have an account? <a href="#" onclick="App.renderAuth('login');event.preventDefault()">Log In</a></p>
    `;
  },

  togglePassword(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (inp.type === 'password') {
      inp.type = 'text';
      btn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    } else {
      inp.type = 'password';
      btn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const idNumber = (document.getElementById('login-idnumber')?.value || '').trim().toUpperCase();
    const password = document.getElementById('login-password')?.value || '';
    if (!idNumber || !password) { this.toast('Please enter your ID and password.', 'warning'); return; }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.classList.add('btn-loading'); submitBtn.textContent = 'Logging in...'; }

    try {
      const res = await this.api('/api/auth/login', { method: 'POST', body: JSON.stringify({ idNumber, password }) });
      if (res.success) {
        this.state.token = res.token;
        this.state.user = this.applyAdminRole(res.user);
        localStorage.setItem('itpe_token', res.token);
        localStorage.setItem('itpe_current_user', JSON.stringify(this.state.user));
        this.toast(`Welcome back, ${res.user.firstName}! 👋`, 'success');
        this.updateUserNav();
        await this.loadSubject();
        await this.loadTopics();
        this.navigate('topics');
      }
    } catch (err) {
      this.toast(err.message || 'Invalid ID or password. Please check your credentials.', 'danger');
      if (submitBtn) { submitBtn.classList.remove('btn-loading'); submitBtn.textContent = 'Log In'; }
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const firstName = (document.getElementById('reg-firstname')?.value || '').trim();
    const lastName  = (document.getElementById('reg-lastname')?.value || '').trim();
    const idNumber  = (document.getElementById('reg-idnumber')?.value || '').trim().toUpperCase();
    const password  = document.getElementById('reg-password')?.value || '';
    const privacyAgreed = document.getElementById('reg-privacy')?.checked;

    if (!firstName) { this.toast('Please enter your First Name.', 'warning'); return; }
    if (!lastName)  { this.toast('Please enter your Last Name.', 'warning'); return; }
    if (!idNumber)  { this.toast('Please enter your Student / Faculty ID.', 'warning'); return; }
    if (!password)  { this.toast('Please create a Password.', 'warning'); return; }
    if (!privacyAgreed) { this.toast('You must agree to the Data Privacy terms.', 'warning'); return; }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Registering...'; }
    try {
      const res = await this.api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ firstName, lastName, idNumber, password, privacyAgreed })
      });
      this.state.user = this.applyAdminRole(res.user);
      this.state.token = res.token;
      localStorage.setItem('itpe_token', res.token);
      localStorage.setItem('itpe_current_user', JSON.stringify(this.state.user));
      this.toast(`Registration successful! Welcome, ${firstName}! 🎉`, 'success');
      this.updateUserNav();
      await this.loadSubject();
      await this.loadTopics();
      this.navigate('topics');
    } catch (err) {
      this.toast(err.message || 'Registration failed. Please try again.', 'danger');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Complete Registration'; }
    }
  },

  logout() {
    this.state.token = null;
    this.state.user = null;
    localStorage.removeItem('itpe_token');
    localStorage.removeItem('itpe_current_user');
    this.updateUserNav();
    this.renderAuth();
    this.toast('Logged out. See you next time! 👋', 'info');
  },

  openPrivacyModal(e) {
    if (e) e.preventDefault();
    this.showModal({
      title: '🛡️ Data Privacy Notice',
      body: `
        <div style="font-size:0.88rem;line-height:1.7;color:rgba(165,180,252,0.8)">
          <p><strong style="color:#f0f2ff">Republic Act No. 10173 (Data Privacy Act of 2012)</strong></p>
          <p style="margin-top:0.5rem">The System Administration and Maintenance Course Portal safeguards student identification data and academic quiz records.</p>
          <h4 style="color:#a5b4fc;margin-top:1rem;font-weight:700">Information Collected:</h4>
          <ul style="margin-left:1.25rem;margin-top:0.35rem;display:flex;flex-direction:column;gap:0.3rem">
            <li>Full Name for official gradebook identification</li>
            <li>Student / Faculty ID (Format: <code style="background:rgba(99,102,241,0.15);padding:1px 5px;border-radius:4px;color:#a5b4fc">TUPT-YY-XXXX</code>)</li>
            <li>Quiz submissions, timestamps, and scores</li>
          </ul>
          <h4 style="color:#a5b4fc;margin-top:1rem;font-weight:700">Purpose:</h4>
          <p>Data is used exclusively for educational evaluation, modular progression, academic grading, and institutional records.</p>
        </div>
      `,
      confirmText: 'Understood & Agreed',
      onConfirm: () => {
        const checkbox = document.getElementById('reg-privacy');
        if (checkbox) checkbox.checked = true;
      }
    });
  },

  openSubjectModal() {
    const s = this.state.subject;
    const passingPercentage = Number(this.state.settings?.passingPercentage) || 50;
    this.showModal({
      title: 'Admin Settings & Subject Details',
      body: `
        <div class="form-group">
          <label class="form-label">Course Passing Grade (%)</label>
          <input type="number" id="modal-passing-grade" class="form-control" value="${passingPercentage}" min="1" max="100" required />
          <small>Default: 50%. This standard applies to all topics and controls quiz progression.</small>
        </div>
        <div class="form-group">
          <label class="form-label">Subject Name</label>
          <input type="text" id="modal-sub-name" class="form-control" value="${s.name}" />
        </div>
        <div class="form-group">
          <label class="form-label">Subject Code</label>
          <input type="text" id="modal-sub-code" class="form-control" value="${s.code}" />
        </div>
        <div class="form-group">
          <label class="form-label">Term / Semester</label>
          <input type="text" id="modal-sub-term" class="form-control" value="${s.term}" />
        </div>
        <div class="form-group">
          <label class="form-label">Year Level & Program</label>
          <input type="text" id="modal-sub-year" class="form-control" value="${s.yearLevel}" />
        </div>
      `,
      confirmText: 'Save Changes',
      onConfirm: async () => {
        const name = document.getElementById('modal-sub-name').value;
        const code = document.getElementById('modal-sub-code').value;
        const term = document.getElementById('modal-sub-term').value;
        const yearLevel = document.getElementById('modal-sub-year').value;
        const passingPercentage = Number(document.getElementById('modal-passing-grade').value);
        if (!Number.isFinite(passingPercentage) || passingPercentage < 1 || passingPercentage > 100) {
          App.toast('Passing grade must be from 1% to 100%.', 'danger');
          return;
        }
        try {
          const res = await App.api('/api/subject', { method: 'PUT', body: JSON.stringify({ name, code, term, yearLevel, passingPercentage }) });
          if (res.success) { App.state.subject = res.subject; App.state.settings = res.settings; App.renderSubjectBanner(); App.closeModal(); App.toast('Admin settings updated!', 'success'); }
        } catch (e) {}
      }
    });
  },

  showModal({ title, body, confirmText = 'OK', cancelText = 'Cancel', onConfirm = null }) {
    const container = document.getElementById('modal-root');
    container.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)App.closeModal()">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="modal-close" onclick="App.closeModal()">&times;</button>
          </div>
          <div class="modal-body">${body}</div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="App.closeModal()">${cancelText}</button>
            <button class="btn btn-primary" id="modal-confirm-btn">${confirmText}</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-confirm-btn').onclick = () => {
      if (onConfirm) onConfirm();
    };
  },

  closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  },

  toast(message, type = 'info') {
    const container = document.getElementById('toast-root');
    const toast = document.createElement('div');
    const icons = { success: '✓', danger: '✕', warning: '⚠', info: 'ℹ' };
    toast.className = `toast-item toast-${type}`;
    toast.innerHTML = `
      <span style="font-size:0.9rem;flex-shrink:0">${icons[type] || 'ℹ'}</span>
      <span style="flex:1">${message}</span>
    `;
    toast.onclick = () => toast.remove();
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'toast-in 0.2s ease reverse both'; setTimeout(() => toast.remove(), 200); }, 4000);
  },

  bindEvents() {
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        this.closeLandingMenu();
        this.closeMobileSidebar();
      }
    });
  }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
