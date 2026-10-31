/**
 * ITPE PROJECT - Quiz Runner Module
 * Handles:
 * - 10-minute timer countdown with warning alerts & auto-submit
 * - Radio selection state
 * - 75% passing threshold requirement
 * - Strict progression lock enforcement (fail => repeat topic, can't proceed to next)
 * - Review and results breakdown
 */

const Quiz = {
  state: {
    topicId: null,
    topicTitle: '',
    settings: {
      timeLimitMinutes: 10,
      passingPercentage: 75
    },
    questions: [],
    userAnswers: {}, // { questionId: selectedOptionIndex }
    timerSecondsLeft: 600, // 10 minutes default
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
        App.toast('Cannot start quiz: Topic is locked. You must pass previous topic quizzes first!', 'danger');
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
        App.toast('⏳ Time is up! Submitting your quiz automatically...', 'warning');
        this.submitQuiz(true);
      }
    }, 1000);
  },

  updateTimerDisplay() {
    const el = document.getElementById('quiz-timer');
    if (!el) return;

    const mins = Math.floor(this.state.timerSecondsLeft / 60);
    const secs = this.state.timerSecondsLeft % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    el.textContent = `⏱️ ${formatted}`;

    // Danger state if under 2 minutes
    const box = document.getElementById('quiz-timer-box');
    if (box) {
      if (this.state.timerSecondsLeft <= 120) {
        box.className = 'quiz-timer-box'; // red alert
      } else {
        box.className = 'quiz-timer-box normal'; // blue
      }
    }
  },

  renderQuizUI() {
    const main = document.getElementById('main-content');
    const qCount = this.state.questions.length;
    const passScore = Math.ceil(qCount * (this.state.settings.passingPercentage / 100));

    let html = `
      <div class="quiz-header">
        <div>
          <span style="font-size: 0.8rem; font-weight: 700; color: var(--primary); text-transform: uppercase;">
            Active Assessment
          </span>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--gray-900); margin: 0.2rem 0;">
            ${this.state.topicTitle} - Quiz
          </h2>
          <div style="font-size: 0.85rem; color: var(--gray-600); display: flex; gap: 1rem;">
            <span>📋 Total Items: <strong>${qCount}</strong></span>
            <span>🎯 Passing Mark: <strong>${this.state.settings.passingPercentage}% (${passScore}/${qCount} correct)</strong></span>
          </div>
        </div>

        <div id="quiz-timer-box" class="quiz-timer-box normal">
          <span id="quiz-timer">⏱️ 10:00</span>
        </div>
      </div>

      <div class="alert alert-info">
        <span>💡 <strong>Whiteboard Exam Rule:</strong> A minimum score of <strong>75%</strong> is required to unlock the subsequent topic module. If the score is below 75%, you must review and repeat the topic lesson.</span>
      </div>

      <form id="quiz-form" onsubmit="Quiz.handleFormSubmit(event)">
    `;

    this.state.questions.forEach((q, idx) => {
      const letters = ['A', 'B', 'C', 'D', 'E'];
      html += `
        <div class="question-card">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--primary);">Question ${idx + 1} of ${qCount}</span>
          </div>
          <div class="question-text">${q.question}</div>
          <div class="options-list">
      `;

      q.options.forEach((opt, optIdx) => {
        const optionLetter = letters[optIdx] || (optIdx + 1);
        html += `
          <label class="option-item" id="opt-label-${q.id}-${optIdx}">
            <input type="radio" name="answer_${q.id}" value="${optIdx}" onchange="Quiz.selectOption('${q.id}', ${optIdx})" />
            <span class="option-letter">${optionLetter}</span>
            <span style="font-size: 0.95rem;">${opt}</span>
          </label>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; background: white; border-radius: var(--radius-lg); border: 1px solid var(--gray-200); margin-top: 1.5rem; box-shadow: var(--shadow-sm);">
          <div>
            <button type="button" class="btn btn-secondary" onclick="Quiz.cancelQuiz()">Cancel & Return to Lessons</button>
          </div>
          <button type="submit" class="btn btn-success btn-lg" id="submit-quiz-btn">
            ✅ Finalize & Submit Quiz
          </button>
        </div>
      </form>
    `;

    main.innerHTML = html;
  },

  selectOption(qId, optIdx) {
    this.state.userAnswers[qId] = optIdx;

    // Highlight selected option visually
    const q = this.state.questions.find(item => item.id === qId);
    if (q) {
      q.options.forEach((_, i) => {
        const label = document.getElementById(`opt-label-${qId}-${i}`);
        if (label) {
          if (i === optIdx) {
            label.classList.add('selected');
          } else {
            label.classList.remove('selected');
          }
        }
      });
    }
  },

  handleFormSubmit(e) {
    e.preventDefault();
    const answeredCount = Object.keys(this.state.userAnswers).length;
    const totalCount = this.state.questions.length;

    if (answeredCount < totalCount) {
      const proceed = confirm(`You have only answered ${answeredCount} out of ${totalCount} questions. Are you sure you want to submit now?`);
      if (!proceed) return;
    }

    this.submitQuiz();
  },

  async submitQuiz(isAuto = false) {
    if (this.state.isSubmitting) return;
    this.state.isSubmitting = true;
    clearInterval(this.state.timerInterval);

    try {
      const res = await App.api(`/api/quizzes/${this.state.topicId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answers: this.state.userAnswers
        })
      });

      if (res.success) {
        this.state.lastResult = res;
        await App.loadTopics(); // refresh progression statuses
        this.renderResults(res);
      }
    } catch (e) {
      this.state.isSubmitting = false;
    }
  },

  cancelQuiz() {
    if (confirm('Are you sure you want to exit the quiz? Any unsaved progress will be lost.')) {
      clearInterval(this.state.timerInterval);
      App.navigate('topic-detail', this.state.topicId);
    }
  },

  renderResults(result) {
    const main = document.getElementById('main-content');
    const isPassed = result.passed;

    let itemsHtml = '';
    (result.itemResults || []).forEach((item, idx) => {
      const letters = ['A', 'B', 'C', 'D'];
      const isCorrect = item.isCorrect;
      const statusIcon = isCorrect ? '✅' : '❌';

      itemsHtml += `
        <div style="padding: 1.25rem; border-radius: var(--radius-md); border: 1.5px solid ${isCorrect ? '#bbf7d0' : '#fecaca'}; background: ${isCorrect ? '#f0fdf4' : '#fef2f2'}; margin-bottom: 1rem;">
          <div style="font-weight: 700; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>${statusIcon} Question ${idx + 1}: ${item.question}</span>
          </div>
          <div style="font-size: 0.85rem; margin-bottom: 0.5rem;">
            <div>Your Answer: <strong>${item.selectedAnswer !== null ? letters[item.selectedAnswer] + ') ' + item.options[item.selectedAnswer] : 'No answer provided'}</strong></div>
            <div style="color: #166534;">Correct Answer: <strong>${letters[item.correctAnswer]}) ${item.options[item.correctAnswer]}</strong></div>
          </div>
          ${item.explanation ? `
            <div style="font-size: 0.8rem; background: rgba(255,255,255,0.7); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); color: var(--gray-700);">
              💡 <strong>Explanation:</strong> ${item.explanation}
            </div>
          ` : ''}
        </div>
      `;
    });

    const bannerHtml = isPassed ? `
      <div class="alert alert-success" style="padding: 1.5rem; flex-direction: column; align-items: flex-start;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 2.2rem;">🎉</span>
          <div>
            <h3 style="font-size: 1.35rem; font-weight: 800; color: #166534;">CONGRATULATIONS! YOU PASSED THE QUIZ!</h3>
            <p style="font-size: 0.95rem; margin-top: 0.25rem;">
              You achieved <strong>${result.percentage}%</strong> (Passing requirement: ${result.passingThreshold}%).
              ${result.nextTopicTitle ? `<strong>${result.nextTopicTitle}</strong> is now UNLOCKED!` : 'You have completed this module!'}
            </p>
          </div>
        </div>
      </div>
    ` : `
      <div class="alert alert-danger" style="padding: 1.5rem; flex-direction: column; align-items: flex-start;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 2.2rem;">⚠️</span>
          <div>
            <h3 style="font-size: 1.35rem; font-weight: 800; color: #991b1b;">QUIZ FAILED - REPEAT TOPIC REQUIRED</h3>
            <p style="font-size: 0.95rem; margin-top: 0.25rem;">
              You scored <strong>${result.percentage}%</strong> (${result.score}/${result.totalQuestions}). Passing requirement is <strong>${result.passingThreshold}%</strong>.
            </p>
            <p style="font-size: 0.9rem; margin-top: 0.5rem; background: rgba(255,255,255,0.8); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); color: #7f1d1d; font-weight: 600;">
              ⛔ WHITEBOARD REQUIREMENT: You CANNOT proceed to the next topic module. Please repeat and review the topic materials and retake the quiz until you achieve 75%.
            </p>
          </div>
        </div>
      </div>
    `;

    main.innerHTML = `
      <div class="card">
        ${bannerHtml}

        <div style="display: flex; justify-content: space-between; align-items: center; margin: 1.5rem 0; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 700;">Score Breakdown: Attempt #${result.attempt}</h3>
            <p style="font-size: 0.85rem; color: var(--gray-600);">Earned: ${result.score} of ${result.totalQuestions} items (${result.percentage}%)</p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            ${isPassed ? `
              <button class="btn btn-primary" onclick="App.navigate('topics')">➡️ Proceed to Table of Contents</button>
            ` : `
              <button class="btn btn-danger" onclick="App.navigate('topic-detail', '${this.state.topicId}')">🔄 Repeat Topic Materials</button>
              <button class="btn btn-primary" onclick="Quiz.start('${this.state.topicId}')">🎯 Retake Quiz Now</button>
            `}
            <button class="btn btn-secondary" onclick="App.navigate('topic-report', '${this.state.topicId}')">📊 View Topic Summary</button>
          </div>
        </div>

        <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 1rem;">Review Question Answers:</h4>
        ${itemsHtml}
      </div>
    `;
  }
};

window.Quiz = Quiz;

