/**
 * ITPE PROJECT - Faculty Management Module with OCR & Automated Quiz Generator
 * 
 * Capabilities:
 * - Dynamic topic module creator
 * - Material upload (Presentations, PDFs, and Photos/Images)
 * - Browser-based OCR to read text and formulas from uploaded photos
 * - Automated 10-minute 75% quiz generation from material content
 * - Interactive slide deck builder
 * - Comprehensive question bank manager
 */

const Faculty = {
  // Temporary storage for staged new topic creation
  stagedFile: null,
  stagedFileBase64: null,
  stagedFileName: '',
  stagedQuestions: [],

  openNewTopicModal() {
    this.stagedFile = null;
    this.stagedFileBase64 = null;
    this.stagedFileName = '';
    this.stagedQuestions = [];

    const quickTopics = [
      'Bisection Method',
      'Newton-Raphson Method',
      'Secant Method',
      'Gaussian Elimination',
      'LU Decomposition',
      'Simpson\'s 1/3 & Trapezoidal Rule',
      'Runge-Kutta 4th Order (RK4)',
      'Error Analysis & Round-off'
    ];

    const chipsHtml = quickTopics.map(t => `
      <span class="topic-chip" onclick="Faculty.applyQuickTopic('${t}')">${t}</span>
    `).join(' ');

    App.showModal({
      title: '➕ Upload Course Topic & Auto-Generate Quiz',
      body: `
        <div style="font-size: 0.88rem; color: #64748b; margin-bottom: 1.25rem;">
          Upload your lecture materials, presentations, or <strong>photos/images of notes and formulas</strong>.
          The built-in OCR and AI engine will read the text and automatically synthesize a 10-minute 75% quiz.
        </div>

        <!-- Section 1: Topic Title -->
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">1. Topic Title</label>
          <input type="text" id="modal-topic-title" class="form-control" placeholder="e.g. Topic 1: Bisection Method & Root Finding" oninput="Faculty.onTitleOrTextChange()" />
          <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center;">
            <span style="font-size: 0.75rem; color: #94a3b8; margin-right: 0.25rem;">Quick Select:</span>
            ${chipsHtml}
          </div>
        </div>

        <!-- Section 2: Upload Material & Image OCR -->
        <div class="form-group" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem;">
          <label class="form-label" style="font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
            <span>2. Upload Material / Photo (PNG, JPG, PDF, TXT, PPT)</span>
            <span style="font-size: 0.75rem; color: #0071e3; font-weight: 600;">📷 OCR Enabled</span>
          </label>
          
          <input type="file" id="modal-material-input" class="form-control" accept="image/*,.pdf,.txt,.ppt,.pptx" onchange="Faculty.handleMaterialFileSelect(event)" style="background: white;" />
          
          <!-- Image OCR Preview & Status Area -->
          <div id="ocr-preview-container" style="display: none; margin-top: 0.85rem; padding: 0.75rem; background: white; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="display: flex; gap: 1rem; align-items: center;">
              <img id="ocr-image-thumb" src="" alt="Material Preview" style="width: 70px; height: 70px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1;" />
              <div style="flex: 1;">
                <div id="ocr-filename" style="font-weight: 700; font-size: 0.88rem; color: #0f172a;">filename.png</div>
                <div id="ocr-status-text" style="font-size: 0.78rem; color: #64748b; margin-top: 0.15rem;">Photo ready for OCR scanning</div>
                <div class="ocr-progress-bar" id="ocr-progress-bar-container" style="display: none;">
                  <div class="ocr-progress-fill" id="ocr-progress-fill"></div>
                </div>
              </div>
              <button type="button" class="btn btn-primary btn-sm" id="btn-run-ocr" onclick="Faculty.runOCR()">
                🔍 Scan Photo (OCR)
              </button>
            </div>
          </div>
        </div>

        <!-- Section 3: Extracted Notes / Lecture Content -->
        <div class="form-group">
          <label class="form-label" style="font-weight: 700; display: flex; justify-content: space-between;">
            <span>3. Lesson Notes & Extracted Content</span>
            <span style="font-size: 0.75rem; color: #64748b;">(Auto-filled by OCR or editable)</span>
          </label>
          <textarea id="modal-topic-lesson" class="form-control" style="min-height: 110px; font-size: 0.85rem;" placeholder="Lecture text, mathematical formulations, and definitions extracted from the material..." oninput="Faculty.onTitleOrTextChange()"></textarea>
        </div>

        <!-- Section 4: Automated Quiz Generation -->
        <div class="form-group" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span style="font-weight: 800; color: #166534; font-size: 0.95rem;">⚡ Automated Quiz Generator</span>
              <span id="quiz-count-badge" class="generated-q-badge" style="margin-left: 0.5rem; background: #dcfce7; color: #166534;">0 Questions</span>
            </div>
            <button type="button" class="btn btn-sm btn-success" onclick="Faculty.triggerAutoQuizGeneration()" style="font-weight: 700;">
              ✨ Generate / Refresh Quiz
            </button>
          </div>

          <div style="font-size: 0.8rem; color: #15803d; margin-bottom: 0.75rem;">
            Rule: 10-minute timer, 75% passing mark. Progression gates next topic until passed.
          </div>

          <!-- Staged Questions Preview List -->
          <div id="staged-questions-list" style="max-height: 220px; overflow-y: auto; padding-right: 0.25rem;">
            <div style="text-align: center; padding: 1.5rem; color: #64748b; font-size: 0.85rem; background: white; border-radius: 8px; border: 1px dashed #cbd5e1;">
              Select a topic or upload photo to auto-generate questions.
            </div>
          </div>
        </div>
      `,
      confirmText: '🚀 Publish Topic & Quiz to Students',
      onConfirm: async () => {
        await Faculty.submitNewTopic();
      }
    });

    // Auto-generate initial set if title default is set
    setTimeout(() => {
      this.applyQuickTopic('Bisection Method');
    }, 100);
  },

  applyQuickTopic(name) {
    const titleInput = document.getElementById('modal-topic-title');
    const lessonInput = document.getElementById('modal-topic-lesson');
    if (!titleInput) return;

    const topicOrder = (App.state.topics ? App.state.topics.length : 0) + 1;
    titleInput.value = `Topic ${topicOrder}: ${name}`;

    if (lessonInput && !lessonInput.value.trim()) {
      lessonInput.value = `Overview of ${name} in Numerical Analysis.\n• Formulations, iterative algorithm steps, and convergence criteria.\n• Stopping condition: absolute error tolerance and relative error analysis.`;
    }

    this.triggerAutoQuizGeneration();
  },

  onTitleOrTextChange() {
    // Debounced quiz regeneration
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this.triggerAutoQuizGeneration(false);
    }, 700);
  },

  handleMaterialFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    this.stagedFile = file;
    this.stagedFileName = file.name;

    const previewContainer = document.getElementById('ocr-preview-container');
    const thumbImg = document.getElementById('ocr-image-thumb');
    const filenameEl = document.getElementById('ocr-filename');
    const statusText = document.getElementById('ocr-status-text');
    const runOcrBtn = document.getElementById('btn-run-ocr');

    previewContainer.style.display = 'block';
    filenameEl.textContent = file.name;

    // Check if image file
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.stagedFileBase64 = e.target.result.split(',')[1];
        thumbImg.src = e.target.result;
        thumbImg.style.display = 'block';
        statusText.textContent = `Photo detected (${(file.size / 1024).toFixed(1)} KB). Ready for OCR extraction.`;
        runOcrBtn.style.display = 'inline-block';
        // Auto-run OCR immediately for convenience!
        this.runOCR();
      };
      reader.readAsDataURL(file);
    } else {
      // Document file (PDF, PPT, TXT)
      thumbImg.src = '/uploads/images/3.png';
      thumbImg.style.display = 'block';
      statusText.textContent = `Document file (${(file.size / 1024).toFixed(1)} KB) attached.`;
      runOcrBtn.style.display = 'none';

      const reader = new FileReader();
      reader.onload = (e) => {
        this.stagedFileBase64 = e.target.result.split(',')[1];
        if (file.type === 'text/plain') {
          const lessonInput = document.getElementById('modal-topic-lesson');
          if (lessonInput && !lessonInput.value) {
            lessonInput.value = atob(this.stagedFileBase64).slice(0, 1000);
            this.triggerAutoQuizGeneration();
          }
        }
      };
      reader.readAsDataURL(file);
    }
  },

  async runOCR() {
    if (!this.stagedFile) {
      App.toast('Please select an image file first.', 'warning');
      return;
    }

    const progressBar = document.getElementById('ocr-progress-bar-container');
    const progressFill = document.getElementById('ocr-progress-fill');
    const statusText = document.getElementById('ocr-status-text');
    const runOcrBtn = document.getElementById('btn-run-ocr');
    const lessonInput = document.getElementById('modal-topic-lesson');

    if (progressBar) progressBar.style.display = 'block';
    if (runOcrBtn) runOcrBtn.disabled = true;

    try {
      const result = await QuizGenerator.extractTextFromImage(this.stagedFile, (pct, msg) => {
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (statusText) statusText.textContent = msg || `Scanning image... ${pct}%`;
      });

      if (result && result.text) {
        if (lessonInput) {
          lessonInput.value = result.text;
        }
        if (statusText) {
          statusText.innerHTML = `✅ <strong style="color: #166534;">OCR Successful!</strong> Extracted text & formulas (${result.engine}).`;
        }
        App.toast('OCR extracted text from photo successfully!', 'success');

        // Automatically synthesize quiz from extracted text!
        this.triggerAutoQuizGeneration(true);
      }
    } catch (e) {
      console.error('OCR Error:', e);
      if (statusText) statusText.textContent = 'OCR scan completed with default analysis.';
    } finally {
      if (runOcrBtn) runOcrBtn.disabled = false;
      setTimeout(() => {
        if (progressBar) progressBar.style.display = 'none';
      }, 1500);
    }
  },

  triggerAutoQuizGeneration(showToast = true) {
    const title = (document.getElementById('modal-topic-title') ? document.getElementById('modal-topic-title').value : '').trim();
    const lesson = (document.getElementById('modal-topic-lesson') ? document.getElementById('modal-topic-lesson').value : '').trim();

    this.stagedQuestions = QuizGenerator.generateQuestions(title, lesson, 10);
    this.renderStagedQuestions();

    if (showToast) {
      App.toast(`Generated ${this.stagedQuestions.length} Numerical Methods questions!`, 'success');
    }
  },

  renderStagedQuestions() {
    const list = document.getElementById('staged-questions-list');
    const badge = document.getElementById('quiz-count-badge');
    if (!list) return;

    if (badge) {
      badge.textContent = `${this.stagedQuestions.length} Questions Generated`;
    }

    if (this.stagedQuestions.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; padding: 1rem; color: #64748b; font-size: 0.85rem;">
          No questions generated yet. Enter a topic title or upload photo material.
        </div>
      `;
      return;
    }

    const letters = ['A', 'B', 'C', 'D'];
    let html = '';

    this.stagedQuestions.forEach((q, idx) => {
      let opts = '';
      (q.options || []).forEach((opt, oIdx) => {
        const isCorrect = oIdx === q.correctAnswer;
        opts += `
          <div style="font-size: 0.8rem; padding: 0.2rem 0.45rem; border-radius: 4px; margin-bottom: 2px; ${isCorrect ? 'background: #dcfce7; font-weight: 700; color: #166534;' : 'color: #334155;'}">
            ${letters[oIdx]}) ${opt} ${isCorrect ? '✓' : ''}
          </div>
        `;
      });

      html += `
        <div class="generated-q-item">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem;">
            <span style="font-size: 0.78rem; font-weight: 700; color: #0071e3;">Item #${idx + 1}</span>
            <button type="button" class="btn btn-danger btn-sm" style="padding: 0.1rem 0.4rem; font-size: 0.7rem;" onclick="Faculty.removeStagedQuestion(${idx})">✕</button>
          </div>
          <div style="font-size: 0.85rem; font-weight: 600; color: #0f172a; margin-bottom: 0.4rem;">${q.question}</div>
          <div style="margin-left: 0.35rem; margin-bottom: 0.35rem;">${opts}</div>
          ${q.explanation ? `<div style="font-size: 0.75rem; color: #64748b; font-style: italic;">💡 ${q.explanation}</div>` : ''}
        </div>
      `;
    });

    list.innerHTML = html;
  },

  removeStagedQuestion(idx) {
    if (this.stagedQuestions.length > idx) {
      this.stagedQuestions.splice(idx, 1);
      this.renderStagedQuestions();
    }
  },

  async submitNewTopic() {
    const titleInput = document.getElementById('modal-topic-title');
    const lessonInput = document.getElementById('modal-topic-lesson');

    const title = titleInput ? titleInput.value.trim() : '';
    const lessonText = lessonInput ? lessonInput.value.trim() : '';

    if (!title) {
      App.toast('Topic Title is required.', 'warning');
      return;
    }

    if (this.stagedQuestions.length === 0) {
      this.triggerAutoQuizGeneration(false);
    }

    let fileUrl = '';
    let fileName = this.stagedFileName || '';

    // If file was attached, upload it first
    if (this.stagedFileBase64) {
      try {
        const upRes = await App.api('/api/upload', {
          method: 'POST',
          body: JSON.stringify({
            filename: fileName,
            dataBase64: this.stagedFileBase64
          })
        });
        if (upRes.success) {
          fileUrl = upRes.fileUrl;
        }
      } catch (err) {
        console.warn('File upload warning:', err);
      }
    }

    // Prepare slides from material or title
    const slides = [
      {
        title: `${title} - Formulation & Overview`,
        content: `• Core principles of ${title}.\n• Numerical algorithm steps.\n• Error analysis and convergence rate.`
      },
      {
        title: `${title} - Implementation Details`,
        content: `• Input parameters and boundary values.\n• Iteration stopping criteria (tolerance ε).\n• Computational complexity & performance.`
      }
    ];

    // Format HTML lesson text
    const formattedLesson = lessonText
      ? lessonText.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('')
      : `<p>Welcome to ${title}. Please review the lecture notes and presentations.</p>`;

    try {
      const res = await App.api('/api/topics', {
        method: 'POST',
        body: JSON.stringify({
          title,
          lessonText: formattedLesson,
          presentationTitle: fileName,
          presentationFileUrl: fileUrl,
          slides,
          summary: `<p><strong>Key Takeaways:</strong> ${title} provides stable numerical convergence under standard conditions. Master the formula and error bounds before taking the quiz.</p>`,
          quizSettings: {
            timeLimitMinutes: 10,
            maxQuestions: Math.min(20, Math.max(5, this.stagedQuestions.length)),
            passingPercentage: 75
          },
          quizQuestions: this.stagedQuestions
        })
      });

      if (res.success) {
        App.closeModal();
        App.toast(`Topic "${title}" and ${this.stagedQuestions.length}-item quiz published!`, 'success');
        await App.loadTopics();
        App.navigate('topics');
      }
    } catch (e) {
      console.error(e);
      App.toast('Failed to save topic: ' + e.message, 'danger');
    }
  },

  openLessonEditor() {
    const t = App.state.currentTopic;
    App.showModal({
      title: '✏️ Edit Topic Lesson Notes',
      body: `
        <div class="form-group">
          <label class="form-label">Topic Title</label>
          <input type="text" id="modal-edit-title" class="form-control" value="${t.title}" />
        </div>
        <div class="form-group">
          <label class="form-label">Lesson Content (HTML / Text formatted)</label>
          <textarea id="modal-edit-lesson" class="form-control" style="min-height: 220px;">${t.lessonText}</textarea>
        </div>
      `,
      confirmText: 'Save Lesson',
      onConfirm: async () => {
        const title = document.getElementById('modal-edit-title').value.trim();
        const lessonText = document.getElementById('modal-edit-lesson').value;

        try {
          const res = await App.api(`/api/topics/${t.id}`, {
            method: 'PUT',
            body: JSON.stringify({ title, lessonText })
          });
          if (res.success) {
            App.state.currentTopic.title = title;
            App.state.currentTopic.lessonText = lessonText;
            App.toast('Lesson content updated successfully!', 'success');
            App.renderTopicDetailView();
          }
        } catch (e) {}
      }
    });
  },

  openSummaryEditor() {
    const t = App.state.currentTopic;
    App.showModal({
      title: '📌 Edit Topic Summary & Key Takeaways',
      body: `
        <div class="form-group">
          <label class="form-label">Topic Summary Content</label>
          <textarea id="modal-edit-summary" class="form-control" style="min-height: 200px;">${t.summary || ''}</textarea>
        </div>
      `,
      confirmText: 'Save Summary',
      onConfirm: async () => {
        const summary = document.getElementById('modal-edit-summary').value;
        try {
          const res = await App.api(`/api/topics/${t.id}`, {
            method: 'PUT',
            body: JSON.stringify({ summary })
          });
          if (res.success) {
            App.state.currentTopic.summary = summary;
            App.toast('Topic summary saved!', 'success');
            App.renderTopicDetailView();
          }
        } catch (e) {}
      }
    });
  },

  openUploadModal() {
    const t = App.state.currentTopic;
    App.showModal({
      title: '📤 Upload Presentation / Photo Material',
      body: `
        <div class="form-group">
          <label class="form-label">Select File (.png, .jpg, .pdf, .pptx, .txt)</label>
          <input type="file" id="modal-upload-file" class="form-control" accept=".pdf,.pptx,.ppt,.txt,.png,.jpg,.jpeg" />
          <small style="color: var(--gray-500); display: block; margin-top: 0.25rem;">
            Images and presentation decks are linked directly into this topic module.
          </small>
        </div>
        <div class="form-group">
          <label class="form-label">Display Title / Material Name</label>
          <input type="text" id="modal-upload-name" class="form-control" placeholder="e.g. Chapter Slides or Formula Photo" />
        </div>
      `,
      confirmText: 'Upload & Attach to Topic',
      onConfirm: () => {
        const fileInput = document.getElementById('modal-upload-file');
        const customTitle = document.getElementById('modal-upload-name').value.trim();

        if (!fileInput.files || fileInput.files.length === 0) {
          App.toast('Please choose a file to upload.', 'warning');
          return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = async (e) => {
          const base64Data = e.target.result.split(',')[1];
          try {
            const res = await App.api('/api/upload', {
              method: 'POST',
              body: JSON.stringify({
                filename: customTitle || file.name,
                dataBase64: base64Data,
                topicId: t.id
              })
            });
            if (res.success) {
              App.toast('Material successfully uploaded and linked!', 'success');
              await App.loadTopicDetail(t.id);
            }
          } catch (err) {}
        };

        reader.readAsDataURL(file);
      }
    });
  },

  openSlideMaker() {
    const t = App.state.currentTopic;
    const slides = t.slides || [];

    let slidesEditorHtml = '';
    slides.forEach((s, idx) => {
      slidesEditorHtml += `
        <div style="border: 1px solid var(--gray-300); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1rem; background: var(--gray-50);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong>Slide #${idx + 1}</strong>
            <button class="btn btn-danger btn-sm" onclick="Faculty.removeSlide(${idx})">🗑️ Delete</button>
          </div>
          <div class="form-group">
            <input type="text" class="form-control" id="slide-title-${idx}" value="${s.title}" placeholder="Slide Heading" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <textarea class="form-control" id="slide-content-${idx}" placeholder="Bullet points or lecture summary">${s.content}</textarea>
          </div>
        </div>
      `;
    });

    App.showModal({
      title: '🖥️ Make Your Own Inside: Slide Deck Builder',
      body: `
        <p style="font-size: 0.85rem; color: var(--gray-600); margin-bottom: 1rem;">
          Design in-browser presentation slides for students to review directly inside this portal.
        </p>
        <div id="slides-container" style="max-height: 380px; overflow-y: auto; padding-right: 0.5rem;">
          ${slidesEditorHtml}
        </div>
        <button class="btn btn-secondary btn-sm" style="margin-top: 0.5rem;" onclick="Faculty.addEmptySlide()">
          ➕ Add Another Slide
        </button>
      `,
      confirmText: 'Save All Slides',
      onConfirm: async () => {
        const updatedSlides = [];
        const count = document.querySelectorAll('#slides-container > div').length;

        for (let i = 0; i < count; i++) {
          const titleEl = document.getElementById(`slide-title-${i}`);
          const contentEl = document.getElementById(`slide-content-${i}`);
          if (titleEl && contentEl) {
            updatedSlides.push({
              title: titleEl.value.trim() || `Slide ${i + 1}`,
              content: contentEl.value.trim()
            });
          }
        }

        try {
          const res = await App.api(`/api/topics/${t.id}`, {
            method: 'PUT',
            body: JSON.stringify({ slides: updatedSlides })
          });
          if (res.success) {
            App.state.currentTopic.slides = updatedSlides;
            App.state.currentSlideIndex = 0;
            App.toast('Interactive slides updated successfully!', 'success');
            App.renderTopicDetailView();
          }
        } catch (e) {}
      }
    });
  },

  addEmptySlide() {
    const t = App.state.currentTopic;
    if (!t.slides) t.slides = [];
    t.slides.push({
      title: `Slide ${t.slides.length + 1}: Key Concept`,
      content: "• Bullet 1\n• Bullet 2\n• Bullet 3"
    });
    App.closeModal();
    this.openSlideMaker();
  },

  removeSlide(idx) {
    const t = App.state.currentTopic;
    if (t.slides && t.slides.length > idx) {
      t.slides.splice(idx, 1);
      App.closeModal();
      this.openSlideMaker();
    }
  },

  async openQuizManager(topicId) {
    const main = document.getElementById('main-content');

    try {
      const res = await App.api(`/api/quizzes/${topicId}`);
      if (!res.success) return;

      const questions = res.questions || [];
      const settings = res.quizSettings || { timeLimitMinutes: 10, maxQuestions: 20, passingPercentage: 75 };

      let qListHtml = '';
      questions.forEach((q, qIdx) => {
        const letters = ['A', 'B', 'C', 'D'];
        let optsHtml = '';
        (q.options || []).forEach((opt, oIdx) => {
          const isCorrect = oIdx === q.correctAnswer;
          optsHtml += `
            <div style="font-size: 0.85rem; padding: 0.25rem 0.5rem; border-radius: 4px; margin-bottom: 2px; ${isCorrect ? 'background: #dcfce7; font-weight: 700; color: #166534;' : ''}">
              ${letters[oIdx]}) ${opt} ${isCorrect ? '✓ (Correct Answer)' : ''}
            </div>
          `;
        });

        qListHtml += `
          <div style="border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1rem; background: white;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
              <span style="font-weight: 700; color: var(--primary);">Question #${qIdx + 1}</span>
              <button class="btn btn-danger btn-sm" onclick="Faculty.deleteQuestion('${topicId}', ${qIdx})">🗑️ Delete</button>
            </div>
            <div style="font-weight: 600; margin-bottom: 0.5rem;">${q.question}</div>
            <div style="margin-left: 0.5rem; margin-bottom: 0.5rem;">${optsHtml}</div>
            ${q.explanation ? `<div style="font-size: 0.8rem; color: var(--gray-600); background: var(--gray-50); padding: 0.35rem 0.5rem; border-radius: 4px;">💡 ${q.explanation}</div>` : ''}
          </div>
        `;
      });

      main.innerHTML = `
        <div style="margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <button class="btn btn-secondary btn-sm" onclick="App.navigate('topics')">⬅️ Back to Table of Contents</button>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-success btn-sm" onclick="Faculty.autoGenerateForExistingTopic('${topicId}')">
              ⚡ Auto-Generate Questions
            </button>
            <button class="btn btn-primary btn-sm" onclick="Faculty.openAddQuestionModal('${topicId}')">
              ➕ Insert Single Question
            </button>
            <button class="btn btn-outline btn-sm" onclick="Faculty.openBulkImportModal('${topicId}')">
              📥 Bulk / Text Import
            </button>
          </div>
        </div>

        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--gray-200); padding-bottom: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <span class="topic-number">Faculty Quiz Controller</span>
              <h2 style="font-size: 1.35rem; font-weight: 800;">${res.topicTitle} - Quiz Configuration</h2>
              <p style="font-size: 0.85rem; color: var(--gray-600);">
                Manage question bank, timer duration, and passing threshold.
              </p>
            </div>
          </div>

          <!-- Quiz Settings Form -->
          <div style="background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--gray-800);">⚙️ Assessment Rules & Constraints</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Time Limit (Minutes)</label>
                <input type="number" id="setting-timer" class="form-control" value="${settings.timeLimitMinutes || 10}" min="1" max="60" />
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Max Questions to Serve</label>
                <input type="number" id="setting-max" class="form-control" value="${settings.maxQuestions || 20}" min="1" max="50" />
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Passing Threshold (%)</label>
                <input type="number" id="setting-passing" class="form-control" value="${settings.passingPercentage || 75}" min="50" max="100" />
              </div>
            </div>
            <div style="margin-top: 1rem; text-align: right;">
              <button class="btn btn-primary btn-sm" onclick="Faculty.saveQuizSettings('${topicId}')">💾 Update Settings</button>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="font-size: 1.1rem; font-weight: 700;">Question Pool (${questions.length} items)</h3>
            <button class="btn btn-success btn-sm" onclick="Faculty.autoGenerateForExistingTopic('${topicId}')">⚡ Auto-Generate</button>
          </div>

          ${questions.length === 0 ? `
            <div style="text-align: center; padding: 2.5rem; color: var(--gray-500); background: var(--gray-50); border-radius: var(--radius-md);">
              <p>No questions currently exist in this topic quiz bank.</p>
              <button class="btn btn-primary btn-sm" style="margin-top: 0.75rem;" onclick="Faculty.autoGenerateForExistingTopic('${topicId}')">⚡ Auto-Generate Quiz Questions Now</button>
            </div>
          ` : qListHtml}
        </div>
      `;
    } catch (e) {
      console.error(e);
    }
  },

  async autoGenerateForExistingTopic(topicId) {
    try {
      const topRes = await App.api(`/api/topics/${topicId}`);
      if (!topRes.success) return;

      const t = topRes.topic;
      const genQuestions = QuizGenerator.generateQuestions(t.title, t.lessonText || '', 10);

      const qRes = await App.api(`/api/quizzes/${topicId}`);
      const currentQs = qRes.questions || [];

      // Combine without duplicates
      const existingTextSet = new Set(currentQs.map(q => q.question));
      let addedCount = 0;
      for (const gq of genQuestions) {
        if (!existingTextSet.has(gq.question)) {
          currentQs.push(gq);
          addedCount++;
        }
      }

      await App.api(`/api/quizzes/${topicId}`, {
        method: 'POST',
        body: JSON.stringify({ questions: currentQs })
      });

      App.toast(`Successfully auto-generated and added ${addedCount} questions to quiz pool!`, 'success');
      Faculty.openQuizManager(topicId);
    } catch (err) {
      App.toast('Failed to auto-generate questions: ' + err.message, 'danger');
    }
  },

  async saveQuizSettings(topicId) {
    const timeLimitMinutes = parseInt(document.getElementById('setting-timer').value, 10);
    const maxQuestions = parseInt(document.getElementById('setting-max').value, 10);
    const passingPercentage = parseInt(document.getElementById('setting-passing').value, 10);

    try {
      const res = await App.api(`/api/quizzes/${topicId}`, {
        method: 'POST',
        body: JSON.stringify({
          quizSettings: { timeLimitMinutes, maxQuestions, passingPercentage }
        })
      });
      if (res.success) {
        App.toast('Quiz settings successfully updated!', 'success');
      }
    } catch (e) {}
  },

  openAddQuestionModal(topicId) {
    App.showModal({
      title: '➕ Insert Single Question',
      body: `
        <div class="form-group">
          <label class="form-label">Question Text</label>
          <textarea id="modal-q-text" class="form-control" placeholder="Type question prompt..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Option A</label>
          <input type="text" id="modal-opt-0" class="form-control" placeholder="First choice" />
        </div>
        <div class="form-group">
          <label class="form-label">Option B</label>
          <input type="text" id="modal-opt-1" class="form-control" placeholder="Second choice" />
        </div>
        <div class="form-group">
          <label class="form-label">Option C</label>
          <input type="text" id="modal-opt-2" class="form-control" placeholder="Third choice" />
        </div>
        <div class="form-group">
          <label class="form-label">Option D</label>
          <input type="text" id="modal-opt-3" class="form-control" placeholder="Fourth choice" />
        </div>
        <div class="form-group">
          <label class="form-label">Correct Option</label>
          <select id="modal-correct-opt" class="form-control">
            <option value="0">Option A</option>
            <option value="1">Option B</option>
            <option value="2">Option C</option>
            <option value="3">Option D</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Explanation / Rationale</label>
          <input type="text" id="modal-q-exp" class="form-control" placeholder="Why this option is correct" />
        </div>
      `,
      confirmText: 'Save Question',
      onConfirm: async () => {
        const text = document.getElementById('modal-q-text').value.trim();
        const o0 = document.getElementById('modal-opt-0').value.trim();
        const o1 = document.getElementById('modal-opt-1').value.trim();
        const o2 = document.getElementById('modal-opt-2').value.trim();
        const o3 = document.getElementById('modal-opt-3').value.trim();
        const correct = parseInt(document.getElementById('modal-correct-opt').value, 10);
        const exp = document.getElementById('modal-q-exp').value.trim();

        if (!text || !o0 || !o1) {
          App.toast('Question and at least 2 options are required.', 'warning');
          return;
        }

        const options = [o0, o1];
        if (o2) options.push(o2);
        if (o3) options.push(o3);

        const newQ = {
          id: 'q_' + Date.now(),
          question: text,
          options,
          correctAnswer: correct,
          explanation: exp
        };

        const qRes = await App.api(`/api/quizzes/${topicId}`);
        const currentQs = qRes.questions || [];
        currentQs.push(newQ);

        const saveRes = await App.api(`/api/quizzes/${topicId}`, {
          method: 'POST',
          body: JSON.stringify({ questions: currentQs })
        });

        if (saveRes.success) {
          App.toast('New question added to bank!', 'success');
          Faculty.openQuizManager(topicId);
        }
      }
    });
  },

  openBulkImportModal(topicId) {
    App.showModal({
      title: '📥 Bulk Upload Quiz / Text Import',
      body: `
        <div class="form-group">
          <label class="form-label">Paste Questions in Standard Text / Database Format:</label>
          <textarea id="modal-bulk-text" class="form-control" style="min-height: 180px; font-family: monospace; font-size: 0.85rem;" placeholder="1. What is the order of convergence for Newton-Raphson?
A) Linear
B) Quadratic
C) Cubic
D) Logarithmic
Answer: B
Explanation: Near a simple root, the Newton-Raphson method converges quadratically."></textarea>
          <small style="color: var(--gray-500); display: block; margin-top: 0.25rem;">
            Format: Numbered questions with A), B), C), D) options, followed by Answer: [Letter].
          </small>
        </div>
        <div class="form-group">
          <label class="form-label">Import Mode</label>
          <select id="modal-import-mode" class="form-control">
            <option value="append">Append to existing questions</option>
            <option value="replace">Replace all existing questions</option>
          </select>
        </div>
      `,
      confirmText: 'Import Questions',
      onConfirm: async () => {
        const rawText = document.getElementById('modal-bulk-text').value.trim();
        const mode = document.getElementById('modal-import-mode').value;

        if (!rawText) {
          App.toast('Please paste formatted questions to import.', 'warning');
          return;
        }

        try {
          const res = await App.api(`/api/quizzes/${topicId}/import`, {
            method: 'POST',
            body: JSON.stringify({ rawText, mode })
          });
          if (res.success) {
            App.toast(res.message, 'success');
            Faculty.openQuizManager(topicId);
          }
        } catch (e) {}
      }
    });
  },

  async deleteQuestion(topicId, qIdx) {
    if (!confirm('Are you sure you want to delete this quiz question?')) return;
    try {
      const qRes = await App.api(`/api/quizzes/${topicId}`);
      const questions = qRes.questions || [];
      questions.splice(qIdx, 1);

      const saveRes = await App.api(`/api/quizzes/${topicId}`, {
        method: 'POST',
        body: JSON.stringify({ questions })
      });
      if (saveRes.success) {
        App.toast('Question removed.', 'info');
        Faculty.openQuizManager(topicId);
      }
    } catch (e) {}
  },

  async deleteTopic(topicId, title) {
    if (!confirm(`Are you sure you want to delete "${title}"? This will remove all materials, slide decks, and quiz records for this topic, and renumber remaining topics.`)) {
      return;
    }
    try {
      const res = await App.api(`/api/topics/${topicId}`, {
        method: 'DELETE'
      });
      if (res.success) {
        App.toast(res.message || 'Topic deleted successfully', 'info');
        await App.loadTopics();
        App.navigate('topics');
      }
    } catch (e) {}
  }
};

window.Faculty = Faculty;
