/**
 * ITPE PROJECT — Quiz Runner Module v2.0 (Redesigned UI)
 */

const Quiz = {
  state: {
    topicId: null,
    topicTitle: '',
    settings: { timeLimitMinutes: 10, passingPercentage: 75 },
    questions: [],
    userAnswers: {},
    timerSecondsLeft: 600,
    timerInterval: null,
    isSubmitting: false,
    lastResult: null
  },

  async start(topicId) {
    this.state.topicId = topicId;
    this.state.userAnswers = {};
    this.state.isSubmitting = false;

    try {
      const res = await App.api(`/api/quizzes/${topicId}`);
      if (!res.success) return;

      this.state.topicTitle = res.topicTitle;
      this.state.settings = res.quizSettings || { timeLimitMinutes: 10, passingPercentage: 75 };
      this.state.questions = res.questions || [];

      if (this.state.questions.length === 0) {
        App.toast('No quiz questions have been prepared for this topic yet.', 'warning');
        App.navigate('topic-detail', topicId);
        return;
      }

      this.state.timerSecondsLeft = (this.state.settings.timeLimitMinutes || 10) * 60;
      this.renderQuizUI();
      this.startTimer();
    } catch (err) {
      if (err.message && err.message.includes('locked')) {
        App.toast('Topic is locked — pass the previous quiz with 75% first!', 'danger');
        App.navigate('topics');
      }
    }
  },

  startTimer() {
    clearInterval(this.state.timerInterval);
    this.updateTimerDisplay();
    this.state.timerInterval = setInterval(() => {
      this.state.timerSecondsLeft--;
      this.updateTimerDisplay();
      if (this.state.timerSecondsLeft <= 0) {
        clearInterval(this.state.timerInterval);
        App.toast('⏳ Time is up! Auto-submitting your quiz...', 'warning');
        this.submitQuiz(true);
      }
    }, 1000);
  },

  updateTimerDisplay() {
    const el = document.getElementById('quiz-timer');
    if (!el) return;
    const mins = Math.floor(this.state.timerSecondsLeft / 60);
    const secs = this.state.timerSecondsLeft % 60;
    el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const box = document.getElementById('quiz-timer-box');
    if (box) {
      box.className = this.state.timerSecondsLeft <= 120 ? 'quiz-timer-box' : 'quiz-timer-box normal';
    }
  },

  renderQuizUI() {
    const main = document.getElementById('main-content');
    const qCount = this.state.questions.length;
    const passScore = Math.ceil(qCount * (this.state.settings.passingPercentage / 100));

    let html = `
      <div class="quiz-header">
        <div>
          <div style="font-size:0.7rem;font-weight:700;color:#06b6d4;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.35rem">Active Assessment</div>
          <h2 style="font-size:1.2rem;font-weight:800;color:#f0f2ff;letter-spacing:-0.02em">${this.state.topicTitle}</h2>
          <div style="font-size:0.8rem;color:rgba(165,180,252,0.6);display:flex;gap:1rem;margin-top:0.25rem;flex-wrap:wrap">
            <span>📋 <strong style="color:#a5b4fc">${qCount}</strong> items</span>
            <span>🎯 Pass: <strong style="color:#a5b4fc">${this.state.settings.passingPercentage}%</strong> (${passScore}/${qCount} correct)</span>
          </div>
        </div>
        <div id="quiz-timer-box" class="quiz-timer-box normal">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span id="quiz-timer">10:00</span>
        </div>
      </div>

      <div class="alert alert-info" style="margin-bottom:1.25rem">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        <span><strong>Whiteboard Rule:</strong> Score at least <strong>75%</strong> to unlock the next module. Below 75% requires topic review before retake.</span>
      </div>

      <form id="quiz-form" onsubmit="Quiz.handleFormSubmit(event)">
    `;

    this.state.questions.forEach((q, idx) => {
      const letters = ['A', 'B', 'C', 'D', 'E'];
      html += `
        <div class="question-card" style="animation-delay:${idx * 0.04}s">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.65rem">
            <span style="font-size:0.7rem;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.08em">Question ${idx + 1} of ${qCount}</span>
            <div id="answer-dot-${q.id}" style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.1);transition:background 0.2s ease"></div>
          </div>
          <div class="question-text">${q.question}</div>
          <div class="options-list">
      `;
      q.options.forEach((opt, optIdx) => {
        html += `
          <label class="option-item" id="opt-label-${q.id}-${optIdx}">
            <input type="radio" name="answer_${q.id}" value="${optIdx}" onchange="Quiz.selectOption('${q.id}', ${optIdx})" />
            <span class="option-letter">${letters[optIdx] || optIdx + 1}</span>
            <span style="font-size:0.92rem;color:rgba(165,180,252,0.85)">${opt}</span>
          </label>
        `;
      });
      html += `</div></div>`;
    });

    html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:1.25rem;background:rgba(20,27,55,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:16px;margin-top:1.25rem;backdrop-filter:blur(16px)">
          <button type="button" class="btn btn-ghost" onclick="Quiz.cancelQuiz()">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Cancel & Exit
          </button>
          <button type="submit" class="btn btn-success btn-lg" id="submit-quiz-btn">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            Submit Quiz
          </button>
        </div>
      </form>
    `;

    main.innerHTML = html;
  },

  selectOption(qId, optIdx) {
    this.state.userAnswers[qId] = optIdx;

    // Visual feedback
    const dot = document.getElementById(`answer-dot-${qId}`);
    if (dot) { dot.style.background = '#10b981'; dot.style.boxShadow = '0 0 8px rgba(16,185,129,0.6)'; }

    const q = this.state.questions.find(item => item.id === qId);
    if (q) {
      q.options.forEach((_, i) => {
        const label = document.getElementById(`opt-label-${qId}-${i}`);
        if (label) label.classList.toggle('selected', i === optIdx);
      });
    }
  },

  handleFormSubmit(e) {
    e.preventDefault();
    const answeredCount = Object.keys(this.state.userAnswers).length;
    const totalCount = this.state.questions.length;
    if (answeredCount < totalCount) {
      const proceed = confirm(`You answered ${answeredCount}/${totalCount} questions. Submit anyway?`);
      if (!proceed) return;
    }
    this.submitQuiz();
  },

  async submitQuiz(isAuto = false) {
    if (this.state.isSubmitting) return;
    this.state.isSubmitting = true;
    clearInterval(this.state.timerInterval);

    const btn = document.getElementById('submit-quiz-btn');
    if (btn) { btn.classList.add('btn-loading'); btn.textContent = 'Submitting...'; }

    try {
      const res = await App.api(`/api/quizzes/${this.state.topicId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: this.state.userAnswers })
      });
      if (res.success) {
        this.state.lastResult = res;
        await App.loadTopics();
        this.renderResults(res);
      }
    } catch (e) {
      this.state.isSubmitting = false;
    }
  },

  cancelQuiz() {
    if (confirm('Exit the quiz? Your progress will be lost.')) {
      clearInterval(this.state.timerInterval);
      App.navigate('topic-detail', this.state.topicId);
    }
  },

  renderResults(result) {
    const main = document.getElementById('main-content');
    const isPassed = result.passed;

    const bannerHtml = isPassed ? `
      <div style="background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(6,182,212,0.1));border:1px solid rgba(16,185,129,0.35);border-radius:16px;padding:1.75rem;margin-bottom:1.5rem;display:flex;align-items:flex-start;gap:1.25rem">
        <div style="width:56px;height:56px;border-radius:14px;background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.4);display:flex;align-items:center;justify-content:center;font-size:1.6rem;flex-shrink:0">🎉</div>
        <div>
          <h3 style="font-size:1.3rem;font-weight:900;color:#34d399;margin-bottom:0.35rem;letter-spacing:-0.02em">PASSED! Excellent Work!</h3>
          <p style="color:rgba(52,211,153,0.75);font-size:0.9rem">
            You scored <strong style="color:#34d399">${result.percentage}%</strong> (${result.score}/${result.totalQuestions} correct). 
            Passing mark: ${result.passingThreshold}%.
            ${result.nextTopicTitle ? `<strong style="color:#34d399"> "${result.nextTopicTitle}" is now unlocked! 🔓</strong>` : ' You completed this module!'}
          </p>
        </div>
      </div>
    ` : `
      <div style="background:linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.06));border:1px solid rgba(239,68,68,0.35);border-radius:16px;padding:1.75rem;margin-bottom:1.5rem;display:flex;align-items:flex-start;gap:1.25rem">
        <div style="width:56px;height:56px;border-radius:14px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);display:flex;align-items:center;justify-content:center;font-size:1.6rem;flex-shrink:0">⚠️</div>
        <div>
          <h3 style="font-size:1.3rem;font-weight:900;color:#f87171;margin-bottom:0.35rem;letter-spacing:-0.02em">Quiz Not Passed — Review Required</h3>
          <p style="color:rgba(248,113,113,0.75);font-size:0.9rem">
            You scored <strong style="color:#f87171">${result.percentage}%</strong> (${result.score}/${result.totalQuestions}). 
            Passing mark is <strong style="color:#f87171">${result.passingThreshold}%</strong>.
          </p>
          <p style="font-size:0.82rem;margin-top:0.35rem;color:rgba(248,113,113,0.6)">⛔ You cannot proceed to the next module. Please review and retake until you score 75% or above.</p>
        </div>
      </div>
    `;

    let itemsHtml = '';
    (result.itemResults || []).forEach((item, idx) => {
      const letters = ['A', 'B', 'C', 'D'];
      const isCorrect = item.isCorrect;
      itemsHtml += `
        <div style="padding:1.15rem;border-radius:14px;border:1px solid ${isCorrect ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};background:${isCorrect ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)'};margin-bottom:0.85rem">
          <div style="font-weight:700;margin-bottom:0.5rem;display:flex;align-items:flex-start;gap:0.65rem;color:${isCorrect ? '#34d399' : '#f87171'}">
            <span style="flex-shrink:0">${isCorrect ? '✅' : '❌'}</span>
            <span style="font-size:0.9rem;color:${isCorrect ? '#a7f3d0' : '#fca5a5'}">Q${idx + 1}: ${item.question}</span>
          </div>
          <div style="font-size:0.82rem;padding-left:1.65rem">
            <div style="color:rgba(165,180,252,0.6);margin-bottom:0.25rem">Your answer: <strong style="color:${isCorrect ? '#34d399' : '#f87171'}">${item.selectedAnswer !== null ? letters[item.selectedAnswer] + ') ' + item.options[item.selectedAnswer] : 'Not answered'}</strong></div>
            ${!isCorrect ? `<div style="color:rgba(52,211,153,0.8)">Correct answer: <strong style="color:#34d399">${letters[item.correctAnswer]}) ${item.options[item.correctAnswer]}</strong></div>` : ''}
            ${item.explanation ? `<div style="font-size:0.78rem;margin-top:0.4rem;padding:0.4rem 0.65rem;background:rgba(255,255,255,0.04);border-radius:6px;color:rgba(165,180,252,0.5)">💡 ${item.explanation}</div>` : ''}
          </div>
        </div>
      `;
    });

    main.innerHTML = `
      <div class="card">
        ${bannerHtml}

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap;gap:0.75rem">
          <div>
            <h3 style="font-size:1rem;font-weight:700;color:#f0f2ff">Score Breakdown — Attempt #${result.attempt}</h3>
            <p style="font-size:0.82rem;color:rgba(165,180,252,0.5)">${result.score} / ${result.totalQuestions} items correct (${result.percentage}%)</p>
          </div>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
            ${isPassed ? `
              <button class="btn btn-success" onclick="App.navigate('topics')">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                Continue to All Modules
              </button>
            ` : `
              <button class="btn btn-danger" onclick="App.navigate('topic-detail','${this.state.topicId}')">🔄 Review Materials</button>
              <button class="btn btn-primary" onclick="Quiz.start('${this.state.topicId}')">🎯 Retake Quiz</button>
            `}
            <button class="btn btn-secondary" onclick="App.navigate('topic-report','${this.state.topicId}')">📊 Topic Summary</button>
          </div>
        </div>

        <div style="background:rgba(0,0,0,0.2);border-radius:10px;overflow:hidden;margin-bottom:1.25rem">
          <div style="height:6px;background:linear-gradient(90deg,${isPassed ? '#10b981,#06b6d4' : '#ef4444,#f97316'});width:${result.percentage}%;transition:width 0.8s cubic-bezier(0.4,0,0.2,1)"></div>
        </div>

        <h4 style="font-size:0.9rem;font-weight:700;color:#a5b4fc;margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          Question Review
        </h4>
        ${itemsHtml}
      </div>
    `;
  }
};

window.Quiz = Quiz;
