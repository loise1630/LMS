/**
 * ITPE PROJECT — Numerical Methods LMS
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
    topics: [],
    currentTopic: null,
    currentSlideIndex: 0
  },

  getLocalUsers() {
    const saved = localStorage.getItem('itpe_users');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    const defaultUsers = [
      { id: "usr_fac_1", idNumber: "TUPT-FAC-001", password: "faculty123", role: "faculty", firstName: "Maria Teresa", lastName: "Santos", privacyAgreed: true },
      { id: "usr_stu_1", idNumber: "TUPT-23-1096", password: "student123", role: "student", firstName: "Juan", lastName: "Dela Cruz", privacyAgreed: true },
      { id: "usr_stu_2", idNumber: "TUPT-23-1097", password: "student123", role: "student", firstName: "Maria Carmela", lastName: "Alvarez", privacyAgreed: true },
      { id: "usr_stu_3", idNumber: "TUPT-23-1098", password: "student123", role: "student", firstName: "Carlo", lastName: "Reyes", privacyAgreed: true },
      { id: "usr_stu_4", idNumber: "TUPT-23-1099", password: "student123", role: "student", firstName: "Kimberly", lastName: "Tan", privacyAgreed: true }
    ];
    localStorage.setItem('itpe_users', JSON.stringify(defaultUsers));
    return defaultUsers;
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

  async init() {
    this.bindEvents();
    this.getLocalUsers();

    const cachedUser = localStorage.getItem('itpe_current_user');
    if (cachedUser) {
      try {
        this.state.user = this.applyAdminRole(JSON.parse(cachedUser));
        localStorage.setItem('itpe_current_user', JSON.stringify(this.state.user));
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
      if (!res.ok) throw new Error(data.message || 'Request failed');
      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      this.toast(err.message, 'danger');
      throw err;
    }
  },

  async checkAuth() {
    const cachedUser = localStorage.getItem('itpe_current_user');
    if (cachedUser) {
      try {
        this.state.user = this.applyAdminRole(JSON.parse(cachedUser));
        localStorage.setItem('itpe_current_user', JSON.stringify(this.state.user));
        this.updateUserNav();
        await this.loadSubject();
        await this.loadTopics();
        this.navigate('topics');
        return;
      } catch (e) {}
    }
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
      return;
    }
    const isFac = this.isFacultyUser();
    nav.innerHTML = `
      <div class="user-pill">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>
        <strong>${this.state.user.lastName}, ${this.state.user.firstName}</strong>
        <code style="background:rgba(99,102,241,0.2);padding:2px 7px;border-radius:4px;font-size:0.7rem;color:#a5b4fc">${this.state.user.idNumber}</code>
        <span class="role-badge ${this.state.user.role}">${this.state.user.role}</span>
      </div>
      ${isFac ? `<button class="btn btn-ghost btn-sm" onclick="App.openSubjectModal()" title="Edit Subject">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
        Settings
      </button>` : ''}
      <button class="btn btn-ghost btn-sm" onclick="App.navigate('master-report')">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        Gradebook
      </button>
      <button class="btn btn-danger btn-sm" onclick="App.logout()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        Logout
      </button>
    `;
  },

  async loadSubject() {
    try {
      const res = await this.api('/api/subject');
      if (res.success) { this.state.subject = res.subject; this.renderSubjectBanner(); }
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
    this.state.currentView = view;
    if (topicId) this.state.selectedTopicId = topicId;

    document.querySelector('.top-nav').style.display = '';
    document.querySelector('.main-wrapper').classList.remove('landing-mode');
    document.body.classList.remove('landing-body');

    const main = document.getElementById('main-content');
    main.innerHTML = '';

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

    let html = `
      <div class="card" style="animation-delay:0s">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:0.75rem">
          <div>
            <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.25rem">
              <div style="width:8px;height:8px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#06b6d4);box-shadow:0 0 8px rgba(99,102,241,0.6)"></div>
              <h2 style="font-size:1.25rem;font-weight:800;color:#f0f2ff;letter-spacing:-0.02em">Course Modules</h2>
              <span class="topic-status-badge in-progress">${topics.length} Topics</span>
            </div>
            <p style="font-size:0.82rem;color:rgba(165,180,252,0.6)">
              ${isFaculty ? 'Faculty portal — manage topics, upload materials, configure quizzes.' : 'Sequential learning — pass 75% to unlock the next module.'}
            </p>
          </div>
          <div style="display:flex;gap:0.5rem">
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('master-report')">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              Gradebook
            </button>
            ${isFaculty ? `<button class="btn btn-primary btn-sm" onclick="Faculty.openNewTopicModal()">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              Add Topic & Quiz
            </button>` : ''}
          </div>
        </div>
    `;

    if (topics.length === 0) {
      if (isFaculty) {
        html += `
          <div style="text-align:center;padding:4rem 2rem;border:2px dashed rgba(99,102,241,0.25);border-radius:20px;background:rgba(99,102,241,0.03)">
            <div style="width:70px;height:70px;margin:0 auto 1.25rem;border-radius:18px;background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(6,182,212,0.1));border:1px solid rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;font-size:1.8rem">📐</div>
            <h3 style="font-size:1.35rem;font-weight:800;color:#f0f2ff;margin-bottom:0.6rem">Curriculum is Empty</h3>
            <p style="color:rgba(165,180,252,0.6);max-width:500px;margin:0 auto 2rem;line-height:1.7;font-size:0.9rem">
              Upload your first topic — lecture notes, slides, or even a <strong style="color:#a5b4fc">photo of your lecture material</strong>. 
              Our AI engine reads the content and auto-generates the 10-minute 75% quiz instantly.
            </p>
            <button class="btn btn-primary" style="padding:0.8rem 2rem;font-size:0.95rem;border-radius:12px" onclick="Faculty.openNewTopicModal()">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              Upload First Topic & Generate Quiz
            </button>
          </div>
        `;
      } else {
        html += `
          <div style="text-align:center;padding:4rem 2rem;border:2px dashed rgba(99,102,241,0.15);border-radius:20px">
            <div style="width:70px;height:70px;margin:0 auto 1.25rem;border-radius:18px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;font-size:1.8rem">⏳</div>
            <h3 style="font-size:1.25rem;font-weight:800;color:#f0f2ff;margin-bottom:0.5rem">No Modules Published Yet</h3>
            <p style="color:rgba(165,180,252,0.5);max-width:440px;margin:0 auto;line-height:1.6;font-size:0.9rem">
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
            <button class="btn btn-ghost btn-sm" onclick="App.navigate('topic-report','${t.id}')">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            </button>
            <button class="btn btn-danger btn-sm" onclick="Faculty.deleteTopic('${t.id}','${t.title.replace(/'/g,"\\'")}')">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
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
              <p>Numerical methods lecture material, interactive slide deck, and timed 75% mastery quiz.</p>
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
        this.toast('Topic locked — pass the previous quiz with 75% first!', 'warning');
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
              Lesson Notes & Mathematical Formulation
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
              <p style="font-size:0.82rem;color:rgba(165,180,252,0.6)">10-minute timer · 75% passing threshold · Strict gating — pass to unlock the next module.</p>
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
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap;gap:0.5rem">
        <button class="btn btn-secondary btn-sm" onclick="App.navigate('topics')">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          All Modules
        </button>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('topic-report','${t.id}')">📊 Summary</button>
          <button class="btn btn-accent btn-sm" onclick="App.navigate('quiz','${t.id}')">🎯 Take Quiz</button>
        </div>
      </div>

      <div class="card">
        <div style="border-bottom:1px solid rgba(255,255,255,0.07);padding-bottom:1.1rem;margin-bottom:1.25rem">
          <div class="topic-number">Module ${t.order}</div>
          <h2 style="font-size:1.5rem;font-weight:900;color:#f0f2ff;letter-spacing:-0.03em;margin-top:0.2rem">${t.title}</h2>
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
    if (banner) banner.innerHTML = '';

    document.querySelector('.top-nav').style.display = 'none';
    document.querySelector('.main-wrapper').classList.add('landing-mode');
    document.body.classList.add('landing-body');

    main.innerHTML = `
      <div class="landing-page-root">
        <!-- Animated background mesh -->
        <div class="landing-bg-mesh"></div>

        <!-- Navigation -->
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
              <button class="btn btn-primary btn-sm" onclick="App.renderAuth('register')" style="border-radius:8px;padding:0.45rem 1.1rem">Register</button>
            </div>
          </div>
        </nav>

        <!-- Hero Section -->
        <div class="landing-hero">
          <div class="landing-hero-inner">
            <!-- Left column -->
            <div class="landing-left">
              <p class="landing-tagline">LEARN &nbsp;•&nbsp; PRACTICE &nbsp;•&nbsp; MASTER</p>
              <h1 class="landing-title">Numerical<br><span>Methods</span></h1>
              <p class="landing-desc">Build mastery in numerical analysis with clear explanations, interactive exercises, OCR-powered quizzes, and real-world problem solving.</p>

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
              <div class="landing-illustration">
                <div class="illust-ground-shadow"></div>
                <img src="/uploads/images/3.png" alt="Ruler" class="illust-img illust-ruler" />
                <img src="/uploads/images/4.png" alt="Pyramid Depth" class="illust-img illust-pyramid-bg" />
                <img src="/uploads/images/5.png" alt="Notes" class="illust-img illust-notepad" />
                <img src="/uploads/images/6.png" alt="Calculator" class="illust-img illust-calc" />
                <img src="/uploads/images/4.png" alt="Pyramid" class="illust-img illust-pyramid-main" />
                <img src="/uploads/images/1.png" alt="Plus" class="illust-img illust-plus-1" />
                <img src="/uploads/images/1.png" alt="Plus" class="illust-img illust-plus-2" />
                <img src="/uploads/images/1.png" alt="Plus" class="illust-img illust-plus-3" />
                <img src="/uploads/images/2.png" alt="Divide" class="illust-img illust-divide-1" />
                <img src="/uploads/images/2.png" alt="Divide" class="illust-img illust-divide-2" />
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
  },

  getLandingLoginHtml() {
    return `
      <h2 class="auth-card-title">Welcome Back</h2>
      <p class="auth-card-subtitle">Log in to continue your numerical methods journey.</p>

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

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.35rem">
          <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.8rem;color:rgba(165,180,252,0.6);cursor:pointer">
            <input type="checkbox" style="accent-color:#6366f1" /> Remember me
          </label>
          <a href="#" onclick="event.preventDefault()" style="font-size:0.8rem;color:#6366f1;font-weight:600;text-decoration:none">Forgot password?</a>
        </div>

        <button type="submit" class="auth-btn-primary">Log In</button>
      </form>

      <div class="auth-divider"><span>OR</span></div>
      <button type="button" class="auth-btn-outline" onclick="App.renderAuth('register')">Create an Account</button>
      <p class="auth-footer-text">Don't have an account? <a href="#" onclick="App.renderAuth('register');event.preventDefault()">Register</a></p>
    `;
  },

  getLandingRegisterHtml() {
    return `
      <h2 class="auth-card-title">Create Account</h2>
      <p class="auth-card-subtitle">Register to start learning numerical methods.</p>

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

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.65rem">
          <div class="auth-field-group">
            <label class="auth-label">Role</label>
            <div class="auth-input-wrap">
              <select id="reg-role" class="auth-input" style="padding-left:0.85rem;cursor:pointer">
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </select>
            </div>
          </div>
          <div class="auth-field-group">
            <label class="auth-label">Password</label>
            <div class="auth-input-wrap">
              <input type="password" id="reg-password" class="auth-input" required placeholder="Create password" style="padding-left:0.85rem" />
            </div>
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

    const users = this.getLocalUsers();
    const localUser = users.find(u => (u.idNumber || '').toUpperCase() === idNumber && u.password === password);

    if (localUser) {
      this.state.user = this.applyAdminRole(localUser);
      localStorage.setItem('itpe_users', JSON.stringify(users));
      this.state.token = 'tok_local_' + Date.now();
      localStorage.setItem('itpe_token', this.state.token);
      localStorage.setItem('itpe_current_user', JSON.stringify(this.state.user));
      this.toast(`Welcome back, ${localUser.firstName}! 👋`, 'success');
      this.updateUserNav();
      await this.loadSubject();
      await this.loadTopics();
      this.navigate('topics');
      return;
    }

    try {
      const res = await this.api('/api/auth/login', { method: 'POST', body: JSON.stringify({ idNumber, password }) });
      if (res.success) {
        this.state.token = res.token;
        this.state.user = this.applyAdminRole(res.user);
        localStorage.setItem('itpe_token', res.token);
        localStorage.setItem('itpe_current_user', JSON.stringify(this.state.user));
        const curUsers = this.getLocalUsers();
        if (!curUsers.some(u => (u.idNumber || '').toUpperCase() === idNumber)) {
          curUsers.push({ ...res.user, password });
          localStorage.setItem('itpe_users', JSON.stringify(curUsers));
        }
        this.toast(`Welcome back, ${res.user.firstName}! 👋`, 'success');
        this.updateUserNav();
        await this.loadSubject();
        await this.loadTopics();
        this.navigate('topics');
      }
    } catch (err) {
      this.toast('Invalid ID or password. Please check your credentials.', 'danger');
      if (submitBtn) { submitBtn.classList.remove('btn-loading'); submitBtn.textContent = 'Log In'; }
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const firstName = (document.getElementById('reg-firstname')?.value || '').trim();
    const lastName  = (document.getElementById('reg-lastname')?.value || '').trim();
    const idNumber  = (document.getElementById('reg-idnumber')?.value || '').trim().toUpperCase();
    const role      = document.getElementById('reg-role')?.value || 'student';
    const assignedRole = idNumber === this.adminId ? 'faculty' : role;
    const password  = document.getElementById('reg-password')?.value || '';
    const privacyAgreed = document.getElementById('reg-privacy')?.checked;

    if (!firstName) { this.toast('Please enter your First Name.', 'warning'); return; }
    if (!lastName)  { this.toast('Please enter your Last Name.', 'warning'); return; }
    if (!idNumber)  { this.toast('Please enter your Student / Faculty ID.', 'warning'); return; }
    if (!password)  { this.toast('Please create a Password.', 'warning'); return; }
    if (!privacyAgreed) { this.toast('You must agree to the Data Privacy terms.', 'warning'); return; }

    const users = this.getLocalUsers();
    const existingIndex = users.findIndex(u => (u.idNumber || '').toUpperCase() === idNumber);
    const newUser = {
      id: existingIndex >= 0 ? users[existingIndex].id : 'usr_' + Date.now(),
      idNumber, firstName, lastName, role: assignedRole, password,
      privacyAgreed: true, privacyAgreedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) users[existingIndex] = newUser;
    else users.push(newUser);
    localStorage.setItem('itpe_users', JSON.stringify(users));

    this.state.user = newUser;
    this.state.token = 'tok_local_' + Date.now();
    localStorage.setItem('itpe_token', this.state.token);
    localStorage.setItem('itpe_current_user', JSON.stringify(newUser));

    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, idNumber, role: assignedRole, password, privacyAgreed })
    }).catch(() => {});

    this.toast(`Registration successful! Welcome, ${firstName}! 🎉`, 'success');
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
    this.toast('Logged out. See you next time! 👋', 'info');
  },

  openPrivacyModal(e) {
    if (e) e.preventDefault();
    this.showModal({
      title: '🛡️ Data Privacy Notice',
      body: `
        <div style="font-size:0.88rem;line-height:1.7;color:rgba(165,180,252,0.8)">
          <p><strong style="color:#f0f2ff">Republic Act No. 10173 (Data Privacy Act of 2012)</strong></p>
          <p style="margin-top:0.5rem">The Numerical Methods Course Portal safeguards student identification data and academic quiz records.</p>
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
    this.showModal({
      title: '⚙️ Edit Subject Details',
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
          const res = await App.api('/api/subject', { method: 'PUT', body: JSON.stringify({ name, code, term, yearLevel }) });
          if (res.success) { App.state.subject = res.subject; App.renderSubjectBanner(); App.toast('Subject details updated!', 'success'); }
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

  bindEvents() {}
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
