/**
 * ITPE PROJECT - Main Application Controller
 * Handles authentication state, tab navigation, modals, and API calls
 * Updated for: Numerical Methods & Student ID authentication (Format: TUPT-23-1096)
 */

const App = {
  state: {
    user: null,
    token: localStorage.getItem('itpe_token') || null,
    currentView: 'topics', // 'topics', 'topic-detail', 'quiz', 'topic-report', 'master-report', 'faculty-quiz'
    selectedTopicId: null,
    activeTopicTab: 'lesson', // 'lesson', 'presentation', 'slides', 'summary'
    subject: null,
    topics: [],
    currentTopic: null,
    currentSlideIndex: 0
  },

  getLocalUsers() {
    const saved = localStorage.getItem('itpe_users');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    const defaultUsers = [
      {
        id: "usr_fac_1",
        idNumber: "TUPT-FAC-001",
        password: "faculty123",
        role: "faculty",
        firstName: "Maria Teresa",
        lastName: "Santos",
        privacyAgreed: true
      },
      {
        id: "usr_stu_1",
        idNumber: "TUPT-23-1096",
        password: "student123",
        role: "student",
        firstName: "Juan",
        lastName: "Dela Cruz",
        privacyAgreed: true
      },
      {
        id: "usr_stu_2",
        idNumber: "TUPT-23-1097",
        password: "student123",
        role: "student",
        firstName: "Maria Carmela",
        lastName: "Alvarez",
        privacyAgreed: true
      },
      {
        id: "usr_stu_3",
        idNumber: "TUPT-23-1098",
        password: "student123",
        role: "student",
        firstName: "Carlo",
        lastName: "Reyes",
        privacyAgreed: true
      },
      {
        id: "usr_stu_4",
        idNumber: "TUPT-23-1099",
        password: "student123",
        role: "student",
        firstName: "Kimberly",
        lastName: "Tan",
        privacyAgreed: true
      }
    ];
    localStorage.setItem('itpe_users', JSON.stringify(defaultUsers));
    return defaultUsers;
  },

  async init() {
    this.bindEvents();
    this.getLocalUsers(); // ensure seed users exist in localStorage

    // Check cached session in localStorage first
    const cachedUser = localStorage.getItem('itpe_current_user');
    if (cachedUser) {
      try {
        this.state.user = JSON.parse(cachedUser);
        this.state.token = localStorage.getItem('itpe_token') || 'tok_local';
        this.updateUserNav();
        await this.loadSubject();
        await this.loadTopics();
        this.navigate('topics');
        return;
      } catch (e) {}
    }

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
      ...(this.state.user ? { 'x-user-id': this.state.user.idNumber || this.state.user.id } : {}),
      ...(options.headers || {})
    };

    try {
      const res = await fetch(endpoint, { ...options, headers });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Request failed');
      }
      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      this.toast(err.message, 'danger');
      throw err;
    }
  },

  async checkAuth() {
    // 1. Check localStorage first
    const cachedUser = localStorage.getItem('itpe_current_user');
    if (cachedUser) {
      try {
        this.state.user = JSON.parse(cachedUser);
        this.updateUserNav();
        await this.loadSubject();
        await this.loadTopics();
        this.navigate('topics');
        return;
      } catch (e) {}
    }

    // 2. Fallback to API check
    try {
      const res = await this.api('/api/auth/me');
      if (res.success && res.user) {
        this.state.user = res.user;
        localStorage.setItem('itpe_current_user', JSON.stringify(res.user));
        this.updateUserNav();
        await this.loadSubject();
        await this.loadTopics();
        this.navigate('topics');
      } else {
        this.logout();
      }
    } catch (err) {
      this.logout();
    }
  },

  updateUserNav() {
    const nav = document.getElementById('user-nav-area');
    if (!this.state.user) {
      nav.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="App.renderAuth()">Log In / Register</button>
      `;
      return;
    }

    const isFac = this.state.user.role === 'faculty';
    nav.innerHTML = `
      <div class="user-pill">
        <span>👤 <strong>${this.state.user.lastName}, ${this.state.user.firstName}</strong></span>
        <code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">${this.state.user.idNumber}</code>
        <span class="role-badge ${this.state.user.role}">${this.state.user.role}</span>
      </div>
      ${isFac ? `<button class="btn btn-outline btn-sm" onclick="App.openSubjectModal()" title="Edit Subject Details">⚙️ Subject Info</button>` : ''}
      <button class="btn btn-secondary btn-sm" onclick="App.navigate('master-report')">📊 Master Gradebook</button>
      <button class="btn btn-danger btn-sm" onclick="App.logout()">Logout</button>
    `;
  },

  async loadSubject() {
    try {
      const res = await this.api('/api/subject');
      if (res.success) {
        this.state.subject = res.subject;
        this.renderSubjectBanner();
      }
    } catch (e) {
      console.error(e);
    }
  },

  renderSubjectBanner() {
    const banner = document.getElementById('subject-banner-area');
    if (!this.state.subject) return;

    const s = this.state.subject;
    const isFaculty = this.state.user && this.state.user.role === 'faculty';

    banner.innerHTML = `
      <div class="subject-banner">
        <div class="subject-info">
          <h2>${s.name}</h2>
          <div class="subject-meta">
            <span>🏷️ <strong>Code:</strong> ${s.code}</span>
            <span>📅 <strong>Term:</strong> ${s.term}</span>
            <span>🎓 <strong>Level:</strong> ${s.yearLevel}</span>
          </div>
        </div>
        <div class="subject-actions">
          ${isFaculty ? `
            <button class="btn btn-primary btn-sm" onclick="Faculty.openNewTopicModal()">➕ Add New Topic</button>
            <button class="btn btn-outline btn-sm" onclick="App.openSubjectModal()">✏️ Edit Subject Details</button>
          ` : `
            <span class="topic-status-badge in-progress">Enrolled Student</span>
          `}
        </div>
      </div>
    `;
  },

  async loadTopics() {
    try {
      const res = await this.api('/api/topics');
      if (res.success) {
        this.state.topics = res.topics;
        if (this.state.currentView === 'topics') {
          this.renderTopicsView();
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  navigate(view, topicId = null) {
    this.state.currentView = view;
    if (topicId) this.state.selectedTopicId = topicId;

    // Show the main app nav bar when navigating inside the app
    document.querySelector('.top-nav').style.display = '';
    document.querySelector('.main-wrapper').classList.remove('landing-mode');
    document.body.classList.remove('landing-body');

    const main = document.getElementById('main-content');
    main.innerHTML = '';

    if (view === 'topics') {
      this.loadTopics();
    } else if (view === 'topic-detail') {
      this.loadTopicDetail(topicId);
    } else if (view === 'quiz') {
      Quiz.start(topicId);
    } else if (view === 'topic-report') {
      Reports.renderTopicReport(topicId);
    } else if (view === 'master-report') {
      Reports.renderMasterReport();
    }
  },

  renderTopicsView() {
    const main = document.getElementById('main-content');
    const isFaculty = this.state.user && this.state.user.role === 'faculty';
    const topicCount = this.state.topics.length;

    let html = `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <h2 style="font-size: 1.35rem; font-weight: 700;">📑 Table of Contents (TOC) / Numerical Methods Lessons</h2>
              <span class="topic-status-badge in-progress">${topicCount} Topics Configured</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--gray-600);">
              ${isFaculty ? 'Faculty Control: You can add as many topics as required, upload slides, manage quizzes, or remove topics.' : 'Modular progression: Each topic quiz requires 75% passing mark to unlock the next topic.'}
            </p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('master-report')">📋 View Master Class Record</button>
            ${isFaculty ? `<button class="btn btn-primary btn-sm" onclick="Faculty.openNewTopicModal()">➕ Add Topic & Auto-Quiz</button>` : ''}
          </div>
        </div>
    `;

    if (topicCount === 0) {
      if (isFaculty) {
        html += `
          <div style="text-align: center; padding: 3.5rem 1.5rem; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: var(--radius-lg); margin-top: 1rem;">
            <div style="font-size: 3rem; margin-bottom: 0.75rem;">📐</div>
            <h3 style="font-size: 1.35rem; font-weight: 800; color: #0f172a; margin-bottom: 0.5rem;">Course Curriculum is Empty</h3>
            <p style="color: #64748b; max-width: 560px; margin: 0 auto 1.5rem; line-height: 1.6; font-size: 0.95rem;">
              As the professor, you upload your lecture topics, notes, presentations, or <strong>photos/images of materials</strong>.
              Our system will automatically scan images using OCR and auto-generate the 10-minute 75% mastery quiz for you!
            </p>
            <button class="btn btn-primary" style="padding: 0.75rem 1.75rem; font-size: 1rem; border-radius: 9999px; font-weight: 700; box-shadow: 0 4px 14px rgba(0, 113, 227, 0.35);" onclick="Faculty.openNewTopicModal()">
              ➕ Upload Topic & Auto-Generate Quiz
            </button>
          </div>
        `;
      } else {
        html += `
          <div style="text-align: center; padding: 3.5rem 1.5rem; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: var(--radius-lg); margin-top: 1rem;">
            <div style="font-size: 3rem; margin-bottom: 0.75rem;">⏳</div>
            <h3 style="font-size: 1.35rem; font-weight: 800; color: #0f172a; margin-bottom: 0.5rem;">Curriculum Pending Publication</h3>
            <p style="color: #64748b; max-width: 500px; margin: 0 auto; line-height: 1.6; font-size: 0.95rem;">
              Your instructor has not uploaded any Numerical Methods topics yet. As soon as topics and automated quizzes are published by your professor, they will appear here.
            </p>
          </div>
        `;
      }
    } else {
      html += `<div class="toc-grid">`;
      for (const t of this.state.topics) {
        let statusBadge = '';
        let actionButtons = '';

        if (isFaculty) {
          statusBadge = `<span class="topic-status-badge in-progress">${t.questionCount} Questions</span>`;
          actionButtons = `
            <button class="btn btn-primary btn-sm" onclick="App.navigate('topic-detail', '${t.id}')">📖 Manage / View</button>
            <button class="btn btn-outline btn-sm" onclick="Faculty.openQuizManager('${t.id}')">📝 Quiz Editor</button>
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('topic-report', '${t.id}')">📊 Summary</button>
            <button class="btn btn-danger btn-sm" onclick="Faculty.deleteTopic('${t.id}', '${t.title}')" title="Delete Topic">🗑️</button>
          `;
        } else {
          if (t.isLocked) {
            statusBadge = `<span class="topic-status-badge locked">🔒 Locked (Pass Prior Quiz)</span>`;
            actionButtons = `
              <button class="btn btn-secondary btn-sm" disabled title="Locked! Pass prior topic with 75%">🔒 Locked</button>
            `;
          } else if (t.status === 'completed') {
            statusBadge = `<span class="topic-status-badge completed">✅ Passed (${t.bestScore}/${t.totalQuestions})</span>`;
            actionButtons = `
              <button class="btn btn-primary btn-sm" onclick="App.navigate('topic-detail', '${t.id}')">📖 Review Lesson</button>
              <button class="btn btn-success btn-sm" onclick="App.navigate('quiz', '${t.id}')">🎯 Retake Quiz</button>
            `;
          } else if (t.status === 'failed') {
            statusBadge = `<span class="topic-status-badge failed">❌ Failed (Repeat Topic)</span>`;
            actionButtons = `
              <button class="btn btn-danger btn-sm" onclick="App.navigate('topic-detail', '${t.id}')">🔄 Repeat Topic First</button>
              <button class="btn btn-primary btn-sm" onclick="App.navigate('quiz', '${t.id}')">🎯 Retake Quiz</button>
            `;
          } else {
            statusBadge = `<span class="topic-status-badge in-progress">⏳ Unlocked</span>`;
            actionButtons = `
              <button class="btn btn-primary btn-sm" onclick="App.navigate('topic-detail', '${t.id}')">📖 Open Lesson</button>
              <button class="btn btn-success btn-sm" onclick="App.navigate('quiz', '${t.id}')">🎯 Take Quiz</button>
            `;
          }
        }

        html += `
          <div class="topic-card ${t.isLocked && !isFaculty ? 'locked' : ''}">
            <div class="topic-header">
              <div>
                <div class="topic-number">Topic ${t.order}</div>
                <h3 class="topic-title">${t.title}</h3>
              </div>
              ${statusBadge}
            </div>
            <div class="topic-card-body">
              <p>Numerical Methods lecture materials, interactive built-in deck, presentation slides, and 10-minute 75% quiz.</p>
            </div>
            <div class="topic-card-footer">
              ${actionButtons}
            </div>
          </div>
        `;
      }
      html += `</div>`;
    }

    html += `
        </div>
      </div>
    `;

    main.innerHTML = html;
  },

  async loadTopicDetail(topicId) {
    try {
      const res = await this.api(`/api/topics/${topicId}`);
      if (res.success) {
        this.state.currentTopic = res.topic;
        this.renderTopicDetailView();
      }
    } catch (e) {
      if (e.message.includes('locked')) {
        this.toast('This topic is locked until you pass the previous topic quiz with 75%!', 'warning');
        this.navigate('topics');
      }
    }
  },

  renderTopicDetailView() {
    const main = document.getElementById('main-content');
    const t = this.state.currentTopic;
    const isFaculty = this.state.user && this.state.user.role === 'faculty';
    const activeTab = this.state.activeTopicTab;

    let contentHtml = '';

    if (activeTab === 'lesson') {
      contentHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--gray-200); line-height: 1.7;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--gray-900);">📝 Lesson Notes & Mathematical Formulation</h3>
            ${isFaculty ? `<button class="btn btn-secondary btn-sm" onclick="Faculty.openLessonEditor()">✏️ Edit Text</button>` : ''}
          </div>
          <div class="lesson-content-body">
            ${t.lessonText || '<p>No lecture text has been added for this topic yet.</p>'}
          </div>
        </div>
      `;
    } else if (activeTab === 'presentation') {
      const pres = t.presentation;
      contentHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="font-size: 1.25rem; font-weight: 700;">📂 Uploaded Presentation</h3>
            ${isFaculty ? `<button class="btn btn-primary btn-sm" onclick="Faculty.openUploadModal()">📤 Upload New File</button>` : ''}
          </div>
          ${pres && (pres.fileUrl || pres.title) ? `
            <div style="background: var(--gray-50); border: 1.5px dashed var(--gray-300); border-radius: var(--radius-md); padding: 1.5rem; text-align: center;">
              ${(pres.fileUrl && /\.(png|jpe?g|webp|gif)$/i.test(pres.fileUrl)) ? `
                <div style="margin-bottom: 1.25rem;">
                  <img src="${pres.fileUrl}" alt="${pres.title || 'Course Material'}" style="max-height: 380px; max-width: 100%; object-fit: contain; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 4px 12px rgba(0,0,0,0.06);" />
                </div>
              ` : `
                <div style="font-size: 3rem; margin-bottom: 0.5rem;">📊</div>
              `}
              <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">${pres.title || 'Course Presentation Slides'}</h4>
              <p style="font-size: 0.85rem; color: var(--gray-500); margin-bottom: 1.25rem;">
                ${pres.fileUrl ? 'Official lecture deck attached by faculty.' : 'Reference deck title: ' + pres.title}
              </p>
              ${pres.fileUrl ? `
                <a href="${pres.fileUrl}" target="_blank" download class="btn btn-primary">
                  ⬇️ Download / Open Material File
                </a>
              ` : `
                <span class="btn btn-secondary" style="cursor: default;">Attached via Curriculum Archive</span>
              `}
            </div>
          ` : `
            <div style="text-align: center; padding: 3rem; color: var(--gray-500);">
              <p>No presentation file has been uploaded for this topic.</p>
              ${isFaculty ? `<button class="btn btn-primary btn-sm" style="margin-top: 1rem;" onclick="Faculty.openUploadModal()">Upload PDF/PPTX</button>` : ''}
            </div>
          `}
        </div>
      `;
    } else if (activeTab === 'slides') {
      const slides = t.slides && t.slides.length > 0 ? t.slides : [
        { title: "No slides created", content: "Faculty can use the slide maker to add presentation cards." }
      ];
      const curIndex = Math.min(this.state.currentSlideIndex, slides.length - 1);
      const slide = slides[curIndex];

      contentHtml = `
        <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="font-size: 1.25rem; font-weight: 700;">🖥️ Interactive Built-in Presentation Deck</h3>
          ${isFaculty ? `<button class="btn btn-secondary btn-sm" onclick="Faculty.openSlideMaker()">✏️ Make Your Own Inside</button>` : ''}
        </div>
        <div class="slide-deck">
          <div class="slide-content">
            <h3>${slide.title}</h3>
            <pre>${slide.content}</pre>
          </div>
          <div class="slide-controls">
            <button class="btn btn-secondary btn-sm" onclick="App.prevSlide()" ${curIndex === 0 ? 'disabled' : ''}>⬅️ Previous</button>
            <span class="slide-counter">Slide ${curIndex + 1} of ${slides.length}</span>
            <button class="btn btn-secondary btn-sm" onclick="App.nextSlide()" ${curIndex === slides.length - 1 ? 'disabled' : ''}>Next ➡️</button>
          </div>
        </div>
      `;
    } else if (activeTab === 'summary') {
      contentHtml = `
        <div style="background: white; padding: 1.5rem; border-radius: var(--radius-md); border: 1px solid var(--gray-200); line-height: 1.7;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">📌 Topic Summary & Key Takeaways</h3>
            ${isFaculty ? `<button class="btn btn-secondary btn-sm" onclick="Faculty.openSummaryEditor()">✏️ Edit Summary</button>` : ''}
          </div>
          <div class="topic-summary-body">
            ${t.summary || '<p>No topic summary provided.</p>'}
          </div>
          <div style="margin-top: 2rem; padding: 1.25rem; background-color: var(--primary-light); border-radius: var(--radius-md); border: 1px solid #bfdbfe; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h4 style="font-weight: 700; color: var(--primary);">Ready to take the Topic Quiz?</h4>
              <p style="font-size: 0.85rem; color: var(--gray-700);">Assessment: 10 Minutes, Passing threshold 75%. Failed quizzes require topic review before retake.</p>
            </div>
            <button class="btn btn-success btn-lg" onclick="App.navigate('quiz', '${t.id}')">🚀 Start Topic Quiz Now</button>
          </div>
        </div>
      `;
    }

    main.innerHTML = `
      <div style="margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center;">
        <button class="btn btn-secondary btn-sm" onclick="App.navigate('topics')">⬅️ Back to All Topics</button>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary btn-sm" onclick="App.navigate('topic-report', '${t.id}')">📊 Topic Quiz Summary</button>
          <button class="btn btn-success btn-sm" onclick="App.navigate('quiz', '${t.id}')">🎯 Take Quiz (10m / 75%)</button>
        </div>
      </div>

      <div class="card">
        <div style="border-bottom: 1px solid var(--gray-200); padding-bottom: 1rem; margin-bottom: 1.25rem;">
          <div class="topic-number">Topic Module ${t.order}</div>
          <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--gray-900); margin-top: 0.25rem;">${t.title}</h2>
        </div>

        <div class="tabs">
          <button class="tab-btn ${activeTab === 'lesson' ? 'active' : ''}" onclick="App.setTopicTab('lesson')">
            📖 Insert Text / Lecture Notes
          </button>
          <button class="tab-btn ${activeTab === 'presentation' ? 'active' : ''}" onclick="App.setTopicTab('presentation')">
            📁 Upload Presentation
          </button>
          <button class="tab-btn ${activeTab === 'slides' ? 'active' : ''}" onclick="App.setTopicTab('slides')">
            🖥️ Make Your Own Inside (Deck)
          </button>
          <button class="tab-btn ${activeTab === 'summary' ? 'active' : ''}" onclick="App.setTopicTab('summary')">
            📌 Topic Summary
          </button>
        </div>

        <div id="topic-tab-content">
          ${contentHtml}
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
    const main = document.getElementById('main-content');
    const banner = document.getElementById('subject-banner-area');
    banner.innerHTML = '';

    // Hide the main nav bar and expand wrapper for landing page
    document.querySelector('.top-nav').style.display = 'none';
    document.querySelector('.main-wrapper').classList.add('landing-mode');
    document.body.classList.add('landing-body');

    main.innerHTML = `
      <!-- Landing Page Nav -->
      <nav class="landing-nav">
        <div class="landing-nav-inner">
          <div class="landing-brand">
            <div class="landing-brand-icon">Σ</div>
            <span class="landing-brand-text">Numerical Methods</span>
          </div>
          <div class="landing-nav-links">
            <a href="#" class="landing-link active" onclick="event.preventDefault()">Home</a>
            <a href="#" class="landing-link" onclick="event.preventDefault()">Learn</a>
            <a href="#" class="landing-link" onclick="event.preventDefault()">Features</a>
            <button class="btn btn-primary btn-sm" onclick="App.renderAuth('register')" style="border-radius: 8px; padding: 0.5rem 1.25rem;">Register</button>
          </div>
        </div>
      </nav>

      <!-- Landing Hero -->
      <div class="landing-hero">
        <div class="landing-hero-inner">
          <!-- Left Column: Hero content -->
          <div class="landing-left">
            <p class="landing-tagline">LEARN &nbsp;•&nbsp; PRACTICE &nbsp;•&nbsp; MASTER</p>
            <h1 class="landing-title">Numerical<br><span>Methods</span></h1>
            <p class="landing-desc">Build your skills in numerical methods with clear explanations, interactive exercises, and real-world problem solving.</p>

            <div class="landing-features">
              <div class="landing-feature-item">
                <div class="landing-feature-icon">
                  <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                </div>
                <span>Step-by-Step<br>Lessons</span>
              </div>
              <div class="landing-feature-item">
                <div class="landing-feature-icon">
                  <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                </div>
                <span>Interactive<br>Exercises</span>
              </div>
              <div class="landing-feature-item">
                <div class="landing-feature-icon">
                  <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                </div>
                <span>Track Your<br>Progress</span>
              </div>
            </div>

            <!-- Illustration using cohesive PNG asset composition from uploads/images -->
            <div class="landing-illustration">
              <!-- Ground ambient shadow to tie the cluster onto a common surface -->
              <div class="illust-ground-shadow"></div>

              <!-- Depth layer: Background pyramid & ruler -->
              <img src="/uploads/images/3.png" alt="Ruler" class="illust-img illust-ruler" />
              <img src="/uploads/images/4.png" alt="Pyramid Depth" class="illust-img illust-pyramid-bg" />

              <!-- Main focal cluster: Math Notepad + Scientific Calculator -->
              <img src="/uploads/images/5.png" alt="Numerical Analysis Notes" class="illust-img illust-notepad" />
              <img src="/uploads/images/6.png" alt="Scientific Calculator" class="illust-img illust-calc" />

              <!-- Main foreground pyramid -->
              <img src="/uploads/images/4.png" alt="Geometric Pyramid" class="illust-img illust-pyramid-main" />

              <!-- Layered floating math symbols connecting the entire scene -->
              <img src="/uploads/images/1.png" alt="Plus Symbol" class="illust-img illust-plus-1" />
              <img src="/uploads/images/1.png" alt="Plus Symbol" class="illust-img illust-plus-2" />
              <img src="/uploads/images/1.png" alt="Plus Symbol" class="illust-img illust-plus-3" />
              <img src="/uploads/images/2.png" alt="Division Symbol" class="illust-img illust-divide-1" />
              <img src="/uploads/images/2.png" alt="Division Symbol" class="illust-img illust-divide-2" />
            </div>
          </div>

          <!-- Right Column: Auth Card -->
          <div class="landing-right">
            <div class="landing-auth-card" id="landing-auth-card">
              ${mode === 'login' ? this.getLandingLoginHtml() : this.getLandingRegisterHtml()}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  getLandingLoginHtml() {
    return `
      <h2 class="auth-card-title">Welcome Back</h2>
      <p class="auth-card-subtitle">Log in to continue your numerical methods journey.</p>

      <form onsubmit="App.handleLogin(event)">
        <div class="auth-field-group">
          <label class="auth-label">Student ID / Faculty ID</label>
          <div class="auth-input-wrap">
            <span class="auth-input-icon">
              <svg width="18" height="18" fill="none" stroke="#94a3b8" stroke-width="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="10" cy="7" r="4"/></svg>
            </span>
            <input type="text" id="login-idnumber" class="auth-input" required placeholder="TUPT-23-1096" autocomplete="username" />
          </div>
        </div>

        <div class="auth-field-group">
          <label class="auth-label">Password</label>
          <div class="auth-input-wrap">
            <span class="auth-input-icon">
              <svg width="18" height="18" fill="none" stroke="#94a3b8" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            </span>
            <input type="password" id="login-password" class="auth-input" required placeholder="Enter your password" autocomplete="current-password" />
            <button type="button" class="auth-eye-btn" onclick="App.togglePassword('login-password', this)" tabindex="-1">
              <svg width="18" height="18" fill="none" stroke="#94a3b8" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: var(--gray-700); cursor: pointer;">
            <input type="checkbox" style="accent-color: #3b5bdb;" /> Remember me
          </label>
          <a href="#" onclick="event.preventDefault()" style="font-size: 0.85rem; color: #3b5bdb; font-weight: 600; text-decoration: none;">Forgot password?</a>
        </div>

        <button type="submit" class="auth-btn-primary">Log In</button>
      </form>

      <div class="auth-divider">
        <span>OR</span>
      </div>

      <button type="button" class="auth-btn-outline" onclick="App.renderAuth('register')">Create an Account</button>

      <p class="auth-footer-text">Don't have an account? <a href="#" onclick="App.renderAuth('register'); event.preventDefault();">Register</a></p>
    `;
  },

  getLandingRegisterHtml() {
    return `
      <h2 class="auth-card-title">Create Account</h2>
      <p class="auth-card-subtitle">Register to start learning numerical methods.</p>

      <form onsubmit="App.handleRegister(event)">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div class="auth-field-group">
            <label class="auth-label">First Name</label>
            <div class="auth-input-wrap">
              <input type="text" id="reg-firstname" class="auth-input" required placeholder="Juan" style="padding-left: 0.85rem;" />
            </div>
          </div>
          <div class="auth-field-group">
            <label class="auth-label">Last Name</label>
            <div class="auth-input-wrap">
              <input type="text" id="reg-lastname" class="auth-input" required placeholder="Dela Cruz" style="padding-left: 0.85rem;" />
            </div>
          </div>
        </div>

        <div class="auth-field-group">
          <label class="auth-label">Student / Faculty ID</label>
          <div class="auth-input-wrap">
            <span class="auth-input-icon">
              <svg width="18" height="18" fill="none" stroke="#94a3b8" stroke-width="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="10" cy="7" r="4"/></svg>
            </span>
            <input type="text" id="reg-idnumber" class="auth-input" required placeholder="TUPT-23-1096" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div class="auth-field-group">
            <label class="auth-label">Role</label>
            <div class="auth-input-wrap">
              <select id="reg-role" class="auth-input" style="padding-left: 0.85rem; cursor: pointer;">
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </select>
            </div>
          </div>
          <div class="auth-field-group">
            <label class="auth-label">Password</label>
            <div class="auth-input-wrap">
              <input type="password" id="reg-password" class="auth-input" required placeholder="Create password" style="padding-left: 0.85rem;" />
            </div>
          </div>
        </div>

        <div class="auth-field-group" style="background: #f8fafc; padding: 0.7rem; border-radius: 8px; border: 1px solid #e2e8f0;">
          <label style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.82rem; cursor: pointer; color: #475569;">
            <input type="checkbox" id="reg-privacy" required style="margin-top: 2px; accent-color: #3b5bdb;" />
            <span>
              I agree to the
              <a href="#" onclick="App.openPrivacyModal(event)" style="color: #3b5bdb; font-weight: 600; text-decoration: underline;">Data Privacy Policy</a>
              (R.A. 10173).
            </span>
          </label>
        </div>

        <button type="submit" class="auth-btn-primary">Complete Registration</button>
      </form>

      <div class="auth-divider"><span>OR</span></div>

      <button type="button" class="auth-btn-outline" onclick="App.renderAuth('login')">Back to Log In</button>

      <p class="auth-footer-text">Already have an account? <a href="#" onclick="App.renderAuth('login'); event.preventDefault();">Log In</a></p>
    `;
  },

  togglePassword(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (inp.type === 'password') {
      inp.type = 'text';
      btn.innerHTML = '<svg width="18" height="18" fill="none" stroke="#94a3b8" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    } else {
      inp.type = 'password';
      btn.innerHTML = '<svg width="18" height="18" fill="none" stroke="#94a3b8" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const idNumber = (document.getElementById('login-idnumber')?.value || '').trim().toUpperCase();
    const password = document.getElementById('login-password')?.value || '';

    if (!idNumber || !password) {
      this.toast('Please enter your ID and password.', 'warning');
      return;
    }

    // 1. Check LocalStorage first (instant local access)
    const users = this.getLocalUsers();
    const localUser = users.find(u => (u.idNumber || '').toUpperCase() === idNumber && u.password === password);

    if (localUser) {
      this.state.user = localUser;
      this.state.token = 'tok_local_' + Date.now();
      localStorage.setItem('itpe_token', this.state.token);
      localStorage.setItem('itpe_current_user', JSON.stringify(localUser));

      this.toast(`Welcome back, ${localUser.firstName}! (${localUser.idNumber})`, 'success');
      this.updateUserNav();
      await this.loadSubject();
      await this.loadTopics();
      this.navigate('topics');
      return;
    }

    // 2. Fallback to server API
    try {
      const res = await this.api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ idNumber, password })
      });
      if (res.success) {
        this.state.token = res.token;
        this.state.user = res.user;
        localStorage.setItem('itpe_token', res.token);
        localStorage.setItem('itpe_current_user', JSON.stringify(res.user));

        // Sync into local users list
        const curUsers = this.getLocalUsers();
        if (!curUsers.some(u => (u.idNumber || '').toUpperCase() === idNumber)) {
          curUsers.push({ ...res.user, password });
          localStorage.setItem('itpe_users', JSON.stringify(curUsers));
        }

        this.toast(`Welcome back, ${res.user.firstName}! (${res.user.idNumber})`, 'success');
        this.updateUserNav();
        await this.loadSubject();
        await this.loadTopics();
        this.navigate('topics');
      }
    } catch (err) {
      this.toast('Invalid ID Number or password. Check credentials or Register.', 'danger');
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const firstName = (document.getElementById('reg-firstname')?.value || '').trim();
    const lastName = (document.getElementById('reg-lastname')?.value || '').trim();
    const idNumber = (document.getElementById('reg-idnumber')?.value || '').trim().toUpperCase();
    const role = document.getElementById('reg-role')?.value || 'student';
    const password = document.getElementById('reg-password')?.value || '';
    const privacyAgreed = document.getElementById('reg-privacy')?.checked;

    if (!firstName) {
      this.toast('Please enter your First Name.', 'warning');
      document.getElementById('reg-firstname')?.focus();
      return;
    }
    if (!lastName) {
      this.toast('Please enter your Last Name.', 'warning');
      document.getElementById('reg-lastname')?.focus();
      return;
    }
    if (!idNumber) {
      this.toast('Please enter your Student / Faculty ID (e.g. TUPT-23-1096).', 'warning');
      document.getElementById('reg-idnumber')?.focus();
      return;
    }
    if (!password) {
      this.toast('Please create a Password.', 'warning');
      document.getElementById('reg-password')?.focus();
      return;
    }
    if (!privacyAgreed) {
      this.toast('You must agree to the Data Privacy terms.', 'warning');
      return;
    }

    // DIRECT LOCALSTORAGE PERSISTENCE (As requested)
    const users = this.getLocalUsers();
    const existingIndex = users.findIndex(u => (u.idNumber || '').toUpperCase() === idNumber);

    const newUser = {
      id: existingIndex >= 0 ? users[existingIndex].id : 'usr_' + Date.now(),
      idNumber: idNumber,
      firstName: firstName,
      lastName: lastName,
      role: role,
      password: password,
      privacyAgreed: true,
      privacyAgreedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      users[existingIndex] = newUser;
    } else {
      users.push(newUser);
    }
    localStorage.setItem('itpe_users', JSON.stringify(users));

    // Set active local session immediately
    this.state.user = newUser;
    this.state.token = 'tok_local_' + Date.now();
    localStorage.setItem('itpe_token', this.state.token);
    localStorage.setItem('itpe_current_user', JSON.stringify(newUser));

    // Background sync to backend if server is active (non-blocking)
    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, idNumber, role, password, privacyAgreed })
    }).catch(() => {});

    this.toast(`Registration successful! Welcome, ${newUser.firstName}!`, 'success');
    this.updateUserNav();
    await this.loadSubject();
    await this.loadTopics();
    this.navigate('topics');
  },

  logout() {
    this.state.token = null;
    this.state.user = null;
    localStorage.removeItem('itpe_token');
    localStorage.removeItem('itpe_current_user');
    this.updateUserNav();
    this.renderAuth();
    this.toast('Logged out successfully.', 'info');
  },

  openPrivacyModal(e) {
    if (e) e.preventDefault();
    this.showModal({
      title: '🛡️ Data Privacy Notice & Compliance Statement',
      body: `
        <div style="font-size: 0.9rem; line-height: 1.6; color: var(--gray-700);">
          <p><strong>Republic Act No. 10173 (Data Privacy Act of 2012)</strong></p>
          <p style="margin-top: 0.5rem;">
            The Numerical Methods Course Portal safeguards student identification data and academic quiz records collected through this system.
          </p>
          <h4 style="font-weight: 700; margin-top: 1rem; color: var(--gray-900);">1. Information Collected:</h4>
          <ul style="margin-left: 1.25rem;">
            <li>Full Name (Surname, First Name) for official gradebook identification</li>
            <li>Student / Faculty ID Number (Format: <code>TUPT-YY-XXXX</code>)</li>
            <li>Quiz submissions, timestamps, attempt counts, and scores</li>
          </ul>
          <h4 style="font-weight: 700; margin-top: 1rem; color: var(--gray-900);">2. Purpose of Processing:</h4>
          <p>
            Collected information is utilized exclusively for educational evaluation, modular progression verification, academic grading, and generating institutional master grade records.
          </p>
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
    this.showModal({
      title: '✏️ Edit Subject Details',
      body: `
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

        try {
          const res = await App.api('/api/subject', {
            method: 'PUT',
            body: JSON.stringify({ name, code, term, yearLevel })
          });
          if (res.success) {
            App.state.subject = res.subject;
            App.renderSubjectBanner();
            App.toast('Subject details updated successfully!', 'success');
          }
        } catch (e) {}
      }
    });
  },

  showModal({ title, body, confirmText = 'OK', cancelText = 'Cancel', onConfirm = null }) {
    const container = document.getElementById('modal-root');
    container.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target === this) App.closeModal()">
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
      App.closeModal();
    };
  },

  closeModal() {
    const container = document.getElementById('modal-root');
    container.innerHTML = '';
  },

  toast(message, type = 'info') {
    const container = document.getElementById('toast-root');
    const toast = document.createElement('div');
    toast.className = `alert alert-${type}`;
    toast.style.cssText = `
      margin-bottom: 0.5rem;
      box-shadow: var(--shadow-md);
      animation: fadeIn 0.2s ease;
    `;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4500);
  },

  bindEvents() {}
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
