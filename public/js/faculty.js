/**
 * ITPE PROJECT - Faculty course and quiz file management
 * 
 * Capabilities:
 * - Dynamic topic module creator
 * - Material upload (Presentations, PDFs, and Photos/Images)
 * - Browser-based OCR to read text and formulas from uploaded photos
 * - Interactive slide deck builder
 * - Comprehensive question bank manager
 */

const Faculty = {
  maxUploadBytes: 20 * 1024 * 1024,
  // Temporary storage for staged new topic creation
  stagedFile: null,
  stagedFileBase64: null,
  stagedFileName: '',
  stagedMaterialText: '',
  stagedQuestions: [],
  quizChoice: 'uploaded',
  pdfOcrWarning: '',
  extractionStartedAt: 0,
  extractionEstimateMs: 0,
  extractionProgressTimer: null,
  extractionEstimateElementId: 'ocr-estimate-text',

  async openQuizUploadModal() {
    try {
      const response = await App.api('/api/topics');
      const topics = response.topics || [];
      if (!topics.length) {
        App.toast('Create a topic first, then upload its quiz file.', 'warning');
        return;
      }
      const options = topics.map(topic =>
        '<option value="' + String(topic.id).replace(/"/g, '&quot;') + '">' +
        'Topic ' + topic.order + ': ' + topic.title.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</option>'
      ).join('');
      App.showModal({
        title: 'Upload Quiz',
        body: '<div class="form-group"><label class="form-label">Choose the topic for this quiz file</label>' +
          '<select id="quiz-upload-topic" class="form-control">' + options + '</select></div>' +
          '<p>Next, choose a TXT, PDF, or PPTX file with numbered questions, options, and correct answers.</p>',
        confirmText: 'Choose Quiz File',
        onConfirm: () => {
          const topicId = document.getElementById('quiz-upload-topic')?.value;
          if (!topicId) return;
          App.closeModal();
          this.openBulkImportModal(topicId);
        }
      });
    } catch (error) {
      App.toast(error.message || 'Could not load topics.', 'danger');
    }
  },

  openNewTopicModal() {
    this.stagedFile = null;
    this.stagedFileBase64 = null;
    this.stagedFileName = '';
    this.stagedMaterialText = '';
    this.stagedQuestions = [];
    this.quizChoice = 'uploaded';
    App.showModal({
      title: 'Upload Course Topic',
      body: `
        <div class="upload-topic-form" style="display:grid;gap:1rem">
          <div style="padding:.25rem 0 .35rem"><span class="upload-topic-kicker">New learning module</span><p class="upload-topic-description">Add a topic, attach its learning material, and set the quiz rules.</p></div>
          <div class="upload-topic-step" style="display:grid;grid-template-columns:42px minmax(0,1fr);gap:.85rem;align-items:start;padding:1rem;border-radius:14px">
            <span class="upload-topic-step-number">1</span>
            <div><label class="form-label" for="modal-topic-title">Topic title</label><input type="text" id="modal-topic-title" class="form-control" placeholder="e.g. Operating System Installation" /><small>Use a short, clear name students can recognize.</small></div>
          </div>
          <div class="upload-topic-step" style="display:grid;grid-template-columns:42px minmax(0,1fr);gap:.85rem;align-items:start;padding:1rem;border-radius:14px">
            <span class="upload-topic-step-number">2</span>
            <div style="min-width:0"><label class="form-label" for="modal-material-input">Learning material</label><input type="file" id="modal-material-input" class="form-control" accept="image/*,.pdf,.txt,.pptx" onchange="Faculty.handleMaterialFileSelect(event)" /><small>PDF, PPTX, TXT, or image · maximum 20 MB. Material is used to prepare a quiz.</small>
              <div id="ocr-preview-container" style="display:none;margin-top:.85rem;padding:.75rem;background:#faf9f8;border-radius:10px;border:1px solid #e8e3e1"><div style="display:flex;gap:.8rem;align-items:center"><img id="ocr-image-thumb" src="" alt="Material preview" style="width:54px;height:54px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0" /><div style="flex:1;min-width:0"><div id="ocr-filename" style="font-weight:700;font-size:.85rem;color:#0f172a;overflow-wrap:anywhere">filename.png</div><div id="ocr-status-text" style="font-size:.76rem;color:#64748b;margin-top:.15rem">Preparing material</div><div id="ocr-estimate-text" style="font-size:.74rem;color:#a65f56;margin-top:.2rem"></div><div class="ocr-progress-bar" id="ocr-progress-bar-container" style="display:none"><div class="ocr-progress-fill" id="ocr-progress-fill"></div></div></div><button type="button" class="btn btn-primary btn-sm" id="btn-run-ocr" onclick="Faculty.runOCR()">Scan image</button></div></div>
            </div>
          </div>
          <div class="upload-topic-step" style="display:grid;grid-template-columns:42px minmax(0,1fr);gap:.85rem;align-items:start;padding:1rem;border-radius:14px">
            <span class="upload-topic-step-number">3</span>
            <div style="width:100%"><strong style="display:block;margin-bottom:.75rem">Quiz settings</strong><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.8rem"><div><label class="form-label" for="modal-topic-timer">Time duration</label><select id="modal-topic-timer" class="form-control">${[5,10,15,20,30,45,60,90,120,180].map(minutes => `<option value="${minutes}" ${minutes === 10 ? 'selected' : ''}>${minutes} minutes</option>`).join('')}</select></div><div><label class="form-label" for="modal-topic-question-count">Number of items</label><select id="modal-topic-question-count" class="form-control" onchange="Faculty.updateStagedQuizCount()">${[5,10,15,20].map(count => `<option value="${count}" ${count === 10 ? 'selected' : ''}>${count} items</option>`).join('')}</select></div><div><label class="form-label" for="modal-topic-retakes">Allowed retakes</label><select id="modal-topic-retakes" class="form-control"><option value="0">No retakes</option>${[1,2,3,5,10].map(count => `<option value="${count}" ${count === 2 ? 'selected' : ''}>${count} ${count === 1 ? 'retake' : 'retakes'}</option>`).join('')}<option value="-1">Unlimited</option></select></div></div><small style="display:block;margin-top:.55rem">Retakes are counted after the initial attempt. Students are submitted automatically when time runs out.</small>
              <div style="margin-top:.9rem;padding:.8rem;border-radius:10px;background:#faf9f8"><label style="display:flex;align-items:flex-start;gap:.5rem"><input id="quiz-choice-generated" type="radio" name="quiz-choice" value="generated" disabled onchange="Faculty.quizChoice='generated'" /><span><strong>Generate quiz from material</strong><small id="generated-quiz-count" style="display:block">waiting for uploaded material</small></span></label><label style="display:flex;align-items:flex-start;gap:.5rem;margin-top:.65rem"><input id="quiz-choice-uploaded" type="radio" name="quiz-choice" value="uploaded" checked onchange="Faculty.quizChoice='uploaded'" /><span><strong>Upload my own quiz</strong><small style="display:block">You can upload its question file after creating the topic.</small></span></label><div id="generated-quiz-preview" style="display:none;max-height:180px;overflow:auto;margin-top:.75rem;padding:.75rem;background:white;border:1px solid #e2e8f0;border-radius:8px"></div></div>
            </div>
          </div>
        </div>
      `,
      confirmText: ' Publish Topic & Quiz to Students',
      onConfirm: async () => {
        await Faculty.submitNewTopic();
      }
    });

  },

  startExtractionEstimate(file, elementId = 'ocr-estimate-text') {
    clearInterval(this.extractionProgressTimer);
    this.extractionEstimateElementId = elementId;
    this.extractionStartedAt = Date.now();
    const sizeMb = file.size / (1024 * 1024);
    const extension = file.name.split('.').pop().toLowerCase();
    const baseSeconds = extension === 'pdf' ? 12 : extension === 'pptx' ? 10 : file.type.startsWith('image/') ? 6 : 2;
    const secondsPerMb = extension === 'pdf' ? 5 : extension === 'pptx' ? 4 : file.type.startsWith('image/') ? 6 : 1;
    this.extractionEstimateMs = Math.min(240, Math.max(5, baseSeconds + sizeMb * secondsPerMb)) * 1000;
    this.renderExtractionEstimate();
    this.extractionProgressTimer = setInterval(() => this.renderExtractionEstimate(), 1000);
  },

  renderExtractionEstimate(progressFraction = 0) {
    const estimate = document.getElementById(this.extractionEstimateElementId);
    if (!this.extractionStartedAt) return;
    const elapsed = Date.now() - this.extractionStartedAt;
    if (progressFraction > 0 && progressFraction < 1) {
      this.extractionEstimateMs = Math.max(this.extractionEstimateMs, elapsed / progressFraction * 0.85);
    }
    const remainingSeconds = Math.max(0, Math.ceil((this.extractionEstimateMs - elapsed) / 1000));
    const remainingText = remainingSeconds > 0
      ? `Estimated time remaining: about ${remainingSeconds < 60 ? `${remainingSeconds} sec` : `${Math.ceil(remainingSeconds / 60)} min`}`
      : 'Finishing up… (estimate reached)';
    if (estimate) estimate.textContent = remainingText;

    const generatedCount = document.getElementById('generated-quiz-count');
    if (generatedCount?.textContent.startsWith('extracting material')) {
      generatedCount.textContent = `extracting material... · ${remainingText}`;
    }
  },

  finishExtractionEstimate(message = 'Extraction and quiz preparation finished') {
    clearInterval(this.extractionProgressTimer);
    this.extractionProgressTimer = null;
    const estimate = document.getElementById(this.extractionEstimateElementId);
    const generatedCount = document.getElementById('generated-quiz-count');
    if (estimate && this.extractionStartedAt) {
      const elapsedSeconds = Math.max(1, Math.ceil((Date.now() - this.extractionStartedAt) / 1000));
      estimate.textContent = `${message} in about ${elapsedSeconds} sec.`;
    }
    if (generatedCount?.textContent.startsWith('extracting material')) {
      generatedCount.textContent = `${message}.`;
    }
    this.extractionStartedAt = 0;
  },

  async extractPdfImageText(file, onProgress = null) {
    this.pdfOcrWarning = '';
    if (typeof Tesseract === 'undefined') {
      this.pdfOcrWarning = 'The OCR library did not load, so text inside PDF photos could not be read.';
      if (onProgress) onProgress(this.pdfOcrWarning);
      return '';
    }
    let worker = null;
    let pdfLoadingTask = null;
    let pdf = null;
    const imageText = [];
    try {
      const pdfjs = await import('/vendor/pdfjs/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/legacy/build/pdf.worker.mjs';
      const bytes = new Uint8Array(await file.arrayBuffer());
      pdfLoadingTask = pdfjs.getDocument({
        data: bytes,
        useSystemFonts: true,
        isEvalSupported: false,
        cMapUrl: '/vendor/pdfjs/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/vendor/pdfjs/standard_fonts/'
      });
      pdf = await pdfLoadingTask.promise;
      const pagesToScan = Math.min(pdf.numPages, 30);
      const imageOps = new Set([
        pdfjs.OPS.paintImageXObject,
        pdfjs.OPS.paintInlineImageXObject,
        pdfjs.OPS.paintImageMaskXObject,
        pdfjs.OPS.paintImageXObjectRepeat
      ]);

      for (let pageNumber = 1; pageNumber <= pagesToScan; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const operators = await page.getOperatorList();
        if (!operators.fnArray.some(operation => imageOps.has(operation))) continue;

        if (!worker) worker = await Tesseract.createWorker('eng', 1);
        if (onProgress) onProgress(`Scanning embedded images on PDF page ${pageNumber} of ${pagesToScan}...`);
        const viewport = page.getViewport({ scale: 1.5 });
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = Math.ceil(viewport.width);
        pageCanvas.height = Math.ceil(viewport.height);
        const context = pageCanvas.getContext('2d', { willReadFrequently: true });
        await page.render({ canvasContext: context, viewport }).promise;

        const result = await worker.recognize(pageCanvas);
        const text = (result?.data?.text || '').trim();
        if (text.length > 12 && (result?.data?.confidence || 0) >= 35) {
          imageText.push(`[Page ${pageNumber}] ${text}`);
        }
        pageCanvas.width = 1;
        pageCanvas.height = 1;
      }

      if (pdf.numPages > pagesToScan && onProgress) {
        this.pdfOcrWarning = `Embedded-image OCR was limited to the first ${pagesToScan} PDF pages.`;
        onProgress(this.pdfOcrWarning);
      }
    } catch (error) {
      console.warn('PDF image OCR could not complete:', error);
      this.pdfOcrWarning = 'PDF text was extracted, but some embedded images could not be OCR-scanned.';
      if (onProgress) onProgress(this.pdfOcrWarning);
    } finally {
      if (worker) await worker.terminate();
      if (pdfLoadingTask) await pdfLoadingTask.destroy();
    }
    return imageText.join('\n');
  },

  async handleMaterialFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > this.maxUploadBytes) {
      event.target.value = '';
      this.stagedFile = null;
      this.stagedFileBase64 = null;
      this.stagedFileName = '';
      this.stagedMaterialText = '';
      this.stagedQuestions = [];
      const preview = document.getElementById('ocr-preview-container');
      const generatedRadio = document.getElementById('quiz-choice-generated');
      const generatedCount = document.getElementById('generated-quiz-count');
      if (preview) preview.style.display = 'none';
      if (generatedRadio) { generatedRadio.checked = false; generatedRadio.disabled = true; }
      if (generatedCount) generatedCount.textContent = 'waiting for an upload within the 20 MB limit';
      App.toast('The selected material exceeds the 20 MB upload limit. Please choose a smaller file.', 'warning');
      return;
    }

    this.stagedFile = file;
    this.stagedFileName = file.name;
    this.startExtractionEstimate(file);
    this.stagedQuestions = [];
    this.quizChoice = 'uploaded';
    this.pdfOcrWarning = '';
    const generatedRadio = document.getElementById('quiz-choice-generated');
    if (generatedRadio) generatedRadio.checked = false;
    const uploadedRadio = document.getElementById('quiz-choice-uploaded');
    if (uploadedRadio) uploadedRadio.checked = true;
    const generatedCount = document.getElementById('generated-quiz-count');
    if (generatedCount) generatedCount.textContent = 'extracting material...';

    const previewContainer = document.getElementById('ocr-preview-container');
    const thumbImg = document.getElementById('ocr-image-thumb');
    const filenameEl = document.getElementById('ocr-filename');
    const statusText = document.getElementById('ocr-status-text');
    const runOcrBtn = document.getElementById('btn-run-ocr');

    previewContainer.style.display = 'block';
    filenameEl.textContent = file.name;
    this.stagedMaterialText = '';
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
      // Text documents are parsed locally by the server; no generic quiz fallback is used.
      thumbImg.src = '/uploads/images/3.png';
      thumbImg.style.display = 'block';
      statusText.textContent = `Reading ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`;
      runOcrBtn.style.display = 'none';
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        this.stagedFileBase64 = btoa(binary);

        if (file.name.toLowerCase().endsWith('.txt')) {
          this.stagedMaterialText = new TextDecoder().decode(bytes);
        } else {
          const extracted = await App.api('/api/extract-document', {
            method: 'POST',
            body: JSON.stringify({ filename: file.name, dataBase64: this.stagedFileBase64 })
          });
          this.stagedMaterialText = extracted.text || '';
          if (extracted.format === 'PDF') {
            const imageText = await this.extractPdfImageText(file, message => {
              statusText.textContent = message;
              const progress = message.match(/page (\d+) of (\d+)/i);
              if (progress) this.renderExtractionEstimate(Number(progress[1]) / Number(progress[2]));
            });
            if (imageText) this.stagedMaterialText += `\n${imageText}`;
          } else if (extracted.format === 'PowerPoint' && extracted.embeddedImages?.length) {
            const imageText = await this.extractEmbeddedImageText(extracted.embeddedImages, message => {
              statusText.textContent = message;
              const progress = message.match(/image (\d+) of (\d+)/i);
              if (progress) this.renderExtractionEstimate(Number(progress[1]) / Number(progress[2]));
            });
            if (imageText) this.stagedMaterialText += `\n${imageText}`;
          }
          statusText.textContent = `Extracted ${this.stagedMaterialText.length.toLocaleString()} characters from ${extracted.sections} ${extracted.format === 'PDF' ? 'pages' : 'slides'}.${this.pdfOcrWarning ? ` ${this.pdfOcrWarning}` : ''}`;
        }

        if (!this.stagedMaterialText.trim()) throw new Error('No readable text found in this file. Try another file or upload your own quiz.');
        this.generateStagedQuiz();
        this.finishExtractionEstimate();
      } catch (error) {
        this.stagedMaterialText = '';
        statusText.textContent = error.message || 'Could not extract text from this file.';
        this.finishExtractionEstimate('Extraction failed');
        if (generatedCount) generatedCount.textContent = 'Extraction failed; retry the file or upload your own quiz.';
      }
    }
  },

  async extractEmbeddedImageText(images, onProgress = null) {
    if (!images?.length || typeof Tesseract === 'undefined') return '';
    let worker = null;
    const extracted = [];
    try {
      worker = await Tesseract.createWorker('eng', 1);
      for (let index = 0; index < images.length; index++) {
        if (onProgress) onProgress(`Reading PowerPoint image ${index + 1} of ${images.length}...`);
        const image = images[index];
        const result = await worker.recognize(`data:${image.mimeType};base64,${image.dataBase64}`);
        const text = (result?.data?.text || '').trim();
        if (text.length > 12 && (result?.data?.confidence || 0) >= 35) extracted.push(`[Image ${index + 1}] ${text}`);
      }
    } catch (error) {
      console.warn('PowerPoint embedded-image OCR could not complete:', error);
      this.pdfOcrWarning = 'PowerPoint text was extracted, but some embedded images could not be OCR-scanned.';
    } finally {
      if (worker) await worker.terminate();
    }
    return extracted.join('\n');
  },

  generateStagedQuiz() {
    const title = document.getElementById('modal-topic-title')?.value.trim() || this.stagedFileName || '';
    const desiredCount = Number(document.getElementById('modal-topic-question-count')?.value) || 10;
    this.stagedQuestions = QuizGenerator.generateQuestionsFromMaterial(this.stagedMaterialText, desiredCount);
    const generatedRadio = document.getElementById('quiz-choice-generated');
    const generatedCount = document.getElementById('generated-quiz-count');
    const preview = document.getElementById('generated-quiz-preview');
    const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
    if (generatedCount) {
      generatedCount.textContent = this.stagedQuestions.length
        ? `${this.stagedQuestions.length} source-based quiz questions for ${title}`
        : 'Not enough clear concepts or actions to make a reliable quiz. Upload a quiz file instead.';
    }
    if (generatedRadio) {
      generatedRadio.disabled = this.stagedQuestions.length < 4;
      if (this.stagedQuestions.length >= 4) {
        generatedRadio.checked = true;
        this.quizChoice = 'generated';
      }
    }
    if (preview) {
      preview.style.display = this.stagedQuestions.length ? 'block' : 'none';
      preview.innerHTML = this.stagedQuestions.slice(0, 3).map((question, index) =>
        `<div style="margin-bottom:.7rem"><strong>Preview ${index + 1}:</strong> ${escapeHtml(question.question)}<br><small>${escapeHtml(question.options[question.correctAnswer])}</small></div>`
      ).join('') + (this.stagedQuestions.length > 3 ? '<small>Previewing 3 questions; the full generated quiz will be saved.</small>' : '');
    }
    if (this.stagedQuestions.length < 4) {
      this.quizChoice = 'uploaded';
      const uploadedRadio = document.getElementById('quiz-choice-uploaded');
      if (uploadedRadio) uploadedRadio.checked = true;
      App.toast('The material did not contain enough clear facts to make a reliable quiz. Upload your own quiz file instead.', 'warning');
    } else {
      App.toast(`Prepared ${this.stagedQuestions.length} quiz questions from the uploaded material.`, 'success');
    }
  },

  updateStagedQuizCount() {
    if (this.stagedMaterialText.trim()) this.generateStagedQuiz();
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

    if (progressBar) progressBar.style.display = 'block';
    if (runOcrBtn) runOcrBtn.disabled = true;

    try {
      const result = await QuizGenerator.extractTextFromImage(this.stagedFile, (pct, msg) => {
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (statusText) statusText.textContent = msg || `Scanning image... ${pct}%`;
        this.renderExtractionEstimate(pct / 100);
      });

      if (result && result.text) {
        this.stagedMaterialText = result.text;
        if (statusText) {
          statusText.innerHTML = ` <strong style="color: #166534;">OCR Successful!</strong> Extracted readable text (${result.engine}).`;
        }
        App.toast('OCR extracted text from photo successfully!', 'success');
        this.generateStagedQuiz();

      } else {
        const message = result?.message || 'No readable text found. Try another file or upload your own quiz.';
        if (statusText) statusText.textContent = message;
        const generatedCount = document.getElementById('generated-quiz-count');
        if (generatedCount) generatedCount.textContent = 'OCR found no readable text; retry or upload your own quiz.';
        App.toast(message, 'warning');
      }
    } catch (e) {
      console.error('OCR Error:', e);
      if (statusText) statusText.textContent = 'OCR could not read this image. Try another image or upload your own quiz.';
      const generatedCount = document.getElementById('generated-quiz-count');
      if (generatedCount) generatedCount.textContent = 'OCR failed; retry or upload your own quiz.';
    } finally {
      this.finishExtractionEstimate(this.stagedMaterialText ? 'Extraction and quiz preparation finished' : 'Extraction failed');
      if (runOcrBtn) runOcrBtn.disabled = false;
      setTimeout(() => {
        if (progressBar) progressBar.style.display = 'none';
      }, 1500);
    }
  },


  async submitNewTopic() {
    const titleInput = document.getElementById('modal-topic-title');
    const title = titleInput ? titleInput.value.trim() : '';
    const selectedQuizChoice = document.querySelector('input[name="quiz-choice"]:checked')?.value || 'uploaded';

    if (!title) {
      App.toast('Topic Title is required.', 'warning');
      return;
    }
    if (selectedQuizChoice === 'generated' && this.stagedQuestions.length < 4) {
      App.toast('At least four clean questions are required. Please upload your own quiz if the material is too noisy.', 'warning');
      return;
    }
    const timeLimitMinutes = Number(document.getElementById('modal-topic-timer')?.value);
    const maxQuestions = Number(document.getElementById('modal-topic-question-count')?.value);
    const maxRetakes = Number(document.getElementById('modal-topic-retakes')?.value);
    if (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 180) {
      App.toast('Set the quiz time limit from 1 to 180 minutes.', 'warning');
      return;
    }
    if (!Number.isInteger(maxQuestions) || maxQuestions < 1 || maxQuestions > 50) {
      App.toast('Choose a valid number of quiz items.', 'warning');
      return;
    }
    if (!Number.isInteger(maxRetakes) || maxRetakes < -1 || maxRetakes > 20) {
      App.toast('Choose a valid number of retakes.', 'warning');
      return;
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
        if (!upRes.success || !upRes.fileUrl) throw new Error('The material upload did not complete.');
        fileUrl = upRes.fileUrl;
      } catch (err) {
        console.warn('File upload warning:', err);
        App.toast('Could not upload the topic material: ' + err.message, 'danger');
        return;
      }
    }

    const slides = [];

    try {
      const res = await App.api('/api/topics', {
        method: 'POST',
        body: JSON.stringify({
          title,
          lessonText: '',
          quizSourceText: this.stagedMaterialText.slice(0, 100000),
          presentationTitle: fileName,
          presentationFileUrl: fileUrl,
          slides,
          summary: '',
          quizSettings: { timeLimitMinutes, maxQuestions, maxRetakes, passingPercentage: 50 },
          quizQuestions: []
        })
      });

      if (res.success) {
        if (selectedQuizChoice === 'generated') {
          const quizRes = await App.api(`/api/quizzes/${res.topic.id}/generated`, {
            method: 'POST',
            body: JSON.stringify({ questions: this.stagedQuestions })
          });
          if (!quizRes.success) throw new Error(quizRes.message || 'Could not save the generated quiz.');
        }
        App.closeModal();
        await App.loadTopics();
        if (selectedQuizChoice === 'uploaded') {
          App.toast(`Topic "${title}" created. Upload your quiz file now.`, 'success');
          this.openBulkImportModal(res.topic.id);
        } else {
          App.toast(`Topic "${title}" and ${this.stagedQuestions.length}-question generated quiz published.`, 'success');
          App.navigate('topics');
        }
      }
    } catch (e) {
      console.error(e);
      App.toast('Failed to save topic: ' + e.message, 'danger');
    }
  },

  openLessonEditor() {
    const t = App.state.currentTopic;
    App.showModal({
      title: ' Edit Topic Lesson Notes',
      body: `
        <div class="form-group">
          <label class="form-label">Topic Title</label>
          <input type="text" id="modal-edit-title" class="form-control" value="${App.escapeHtml(t.title)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Lesson Content (HTML / Text formatted)</label>
          <textarea id="modal-edit-lesson" class="form-control" style="min-height: 220px;">${App.escapeHtml(t.lessonText)}</textarea>
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
      title: ' Edit Topic Summary & Key Takeaways',
      body: `
        <div class="form-group">
          <label class="form-label">Topic Summary Content</label>
          <textarea id="modal-edit-summary" class="form-control" style="min-height: 200px;">${App.escapeHtml(t.summary || '')}</textarea>
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
      title: ' Upload Presentation / Photo Material',
      body: `
        <div class="form-group">
          <label class="form-label">Select File (.png, .jpg, .pdf, .pptx, .txt)</label>
          <input type="file" id="modal-upload-file" class="form-control" accept=".pdf,.pptx,.ppt,.txt,.png,.jpg,.jpeg" />
          <small>Maximum file size: 20 MB.</small>
          <small style="color: var(--gray-500); display: block; margin-top: 0.25rem;">
            Images and presentation decks are linked directly into this topic module.
          </small>
        </div>
        <div class="form-group">
          <label class="form-label">Display Title / Material Name</label>
          <input type="text" id="modal-upload-name" class="form-control" placeholder="e.g. Server Setup Guide or Network Diagram" />
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
        if (file.size > this.maxUploadBytes) {
          App.toast('The selected material exceeds the 20 MB upload limit. Please choose a smaller file.', 'warning');
          return;
        }
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
            <button class="btn btn-danger btn-sm" onclick="Faculty.removeSlide(${idx})"> Delete</button>
          </div>
          <div class="form-group">
            <input type="text" class="form-control" id="slide-title-${idx}" value="${App.escapeHtml(s.title)}" placeholder="Slide Heading" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <textarea class="form-control" id="slide-content-${idx}" placeholder="Bullet points or lecture summary">${App.escapeHtml(s.content)}</textarea>
          </div>
        </div>
      `;
    });

    App.showModal({
      title: ' Make Your Own Inside: Slide Deck Builder',
      body: `
        <p style="font-size: 0.85rem; color: var(--gray-600); margin-bottom: 1rem;">
          Design in-browser presentation slides for students to review directly inside this portal.
        </p>
        <div id="slides-container" style="max-height: 380px; overflow-y: auto; padding-right: 0.5rem;">
          ${slidesEditorHtml}
        </div>
        <button class="btn btn-secondary btn-sm" style="margin-top: 0.5rem;" onclick="Faculty.addEmptySlide()">
           Add Another Slide
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
      const settings = res.quizSettings || { timeLimitMinutes: 10, maxQuestions: 20, maxRetakes: -1, passingPercentage: 50 };

      let qListHtml = '';
      questions.forEach((q, qIdx) => {
        const letters = ['A', 'B', 'C', 'D'];
        let optsHtml = '';
        (q.options || []).forEach((opt, oIdx) => {
          const isCorrect = oIdx === q.correctAnswer;
          optsHtml += `
            <div style="font-size: 0.85rem; padding: 0.25rem 0.5rem; border-radius: 4px; margin-bottom: 2px; ${isCorrect ? 'background: #dcfce7; font-weight: 700; color: #166534;' : ''}">
              ${letters[oIdx]}) ${App.escapeHtml(opt)} ${isCorrect ? ' (Correct Answer)' : ''}
            </div>
          `;
        });

        qListHtml += `
          <div style="border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1rem; background: white;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
              <span style="font-weight: 700; color: var(--primary);">Question #${qIdx + 1}</span>
              <button class="btn btn-danger btn-sm" onclick="Faculty.deleteQuestion('${topicId}', ${qIdx})"> Delete</button>
            </div>
            <div style="font-weight: 600; margin-bottom: 0.5rem;">${App.escapeHtml(q.question)}</div>
            <div style="margin-left: 0.5rem; margin-bottom: 0.5rem;">${optsHtml}</div>
            ${q.explanation ? `<div style="font-size: 0.8rem; color: var(--gray-600); background: var(--gray-50); padding: 0.35rem 0.5rem; border-radius: 4px;"> ${App.escapeHtml(q.explanation)}</div>` : ''}
          </div>
        `;
      });

      main.innerHTML = `
        <div style="margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <button class="btn btn-secondary btn-sm" onclick="App.goBack('topics')">Back to modules</button>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-success btn-sm" onclick="Faculty.regenerateQuizFromMaterial('${topicId}')">
              Regenerate from Uploaded Material
            </button>
            <button class="btn btn-primary btn-sm" onclick="Faculty.openAddQuestionModal('${topicId}')">
              Upload Quiz File
            </button>
          </div>
        </div>

        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--gray-200); padding-bottom: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <span class="topic-number">Faculty Quiz Controller</span>
              <h2 style="font-size: 1.35rem; font-weight: 800;">${App.escapeHtml(res.topicTitle)} - Quiz Configuration</h2>
              <p style="font-size: 0.85rem; color: var(--gray-600);">
                Manage question bank, timer duration, and passing threshold.
              </p>
            </div>
          </div>

          <!-- Quiz Settings Form -->
          <div style="background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem;">
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--gray-800);"> Assessment Rules & Constraints</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Time Limit (Minutes)</label>
                <input type="number" id="setting-timer" class="form-control" value="${settings.timeLimitMinutes || 10}" min="1" max="180" />
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Max Questions to Serve</label>
                <input type="number" id="setting-max" class="form-control" value="${settings.maxQuestions || 20}" min="1" max="50" />
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Allowed Retakes</label>
                <select id="setting-retakes" class="form-control">
                  <option value="0" ${Number(settings.maxRetakes) === 0 ? 'selected' : ''}>No retakes</option>
                  ${[1,2,3,5,10].map(count => `<option value="${count}" ${Number(settings.maxRetakes) === count ? 'selected' : ''}>${count} ${count === 1 ? 'retake' : 'retakes'}</option>`).join('')}
                  <option value="-1" ${Number(settings.maxRetakes ?? -1) < 0 ? 'selected' : ''}>Unlimited</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Course Passing Standard</label>
                <div class="form-control" style="height:auto;">${App.state.settings?.passingPercentage || 50}% (set in Admin Settings)</div>
              </div>
            </div>
            <div style="margin-top: 1rem; text-align: right;">
              <button class="btn btn-primary btn-sm" onclick="Faculty.saveQuizSettings('${topicId}')"> Update Settings</button>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="font-size: 1.1rem; font-weight: 700;">Question Pool (${questions.length} items)</h3>
          </div>

          ${questions.length === 0 ? `
            <div style="text-align: center; padding: 2.5rem; color: var(--gray-500); background: var(--gray-50); border-radius: var(--radius-md);">
              <p>No questions currently exist in this topic quiz bank.</p>
            </div>
          ` : qListHtml}
        </div>
      `;
    } catch (e) {
      console.error(e);
    }
  },

  async regenerateQuizFromMaterial(topicId) {
    try {
      const response = await App.api(`/api/topics/${topicId}`);
      if (!response.success) throw new Error('Could not load the uploaded topic material.');
      const html = new DOMParser().parseFromString(response.topic.lessonText || '', 'text/html');
      const materialText = response.topic.quizSourceText || html.body.textContent || '';
      const questions = QuizGenerator.generateQuestionsFromMaterial(materialText, 10);
      if (questions.length < 4) {
        App.toast('The stored material does not contain enough clear concepts or actions for a reliable quiz. Use Upload Quiz File instead.', 'warning');
        return;
      }
      if (!confirm(`Replace this topic's current quiz with ${questions.length} questions generated from its uploaded material?`)) return;
      const saved = await App.api(`/api/quizzes/${topicId}/generated`, {
        method: 'POST',
        body: JSON.stringify({ questions })
      });
      if (!saved.success) throw new Error(saved.message || 'Could not replace the quiz.');
      App.toast(`Replaced the quiz with ${questions.length} readable, material-based questions.`, 'success');
      this.openQuizManager(topicId);
    } catch (error) {
      App.toast(error.message || 'Could not regenerate the quiz.', 'danger');
    }
  },


  async saveQuizSettings(topicId) {
    const timeLimitMinutes = parseInt(document.getElementById('setting-timer').value, 10);
    const maxQuestions = parseInt(document.getElementById('setting-max').value, 10);
    const maxRetakes = parseInt(document.getElementById('setting-retakes').value, 10);
    const passingPercentage = Number(App.state.settings?.passingPercentage) || 50;

    if (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 180) {
      App.toast('Set the quiz time limit from 1 to 180 minutes.', 'warning');
      return;
    }
    if (!Number.isInteger(maxQuestions) || maxQuestions < 1 || maxQuestions > 50) {
      App.toast('Set the question limit from 1 to 50.', 'warning');
      return;
    }
    if (!Number.isInteger(maxRetakes) || maxRetakes < -1 || maxRetakes > 20) {
      App.toast('Choose a valid number of retakes.', 'warning');
      return;
    }

    try {
      const res = await App.api(`/api/quizzes/${topicId}`, {
        method: 'POST',
        body: JSON.stringify({
          quizSettings: { timeLimitMinutes, maxQuestions, maxRetakes, passingPercentage }
        })
      });
      if (res.success) {
        if (App.state.currentTopic?.id === topicId) {
          App.state.currentTopic.quizSettings = { ...(App.state.currentTopic.quizSettings || {}), timeLimitMinutes, maxQuestions, maxRetakes };
        }
        App.toast('Quiz settings successfully updated!', 'success');
      }
    } catch (e) {}
  },

  openAddQuestionModal(topicId) {
    return this.openBulkImportModal(topicId);
  },

  openBulkImportModal(topicId) {
    App.showModal({
      title: ' Upload Quiz File',
      body: `
        <div class="form-group">
          <label class="form-label">Upload Quiz File (TXT, PDF, or PPTX)</label>
          <input type="file" id="modal-quiz-file" class="form-control" accept=".txt,.pdf,.pptx" onchange="Faculty.readQuizFile(event, '${topicId}')" />
          <small id="modal-quiz-estimate" style="color: #0071e3; display:block; margin-top:.25rem;"></small>
          <small id="modal-quiz-file-status" style="color: var(--gray-500); display: block; margin-top: 0.35rem;">Upload a TXT, PDF, or PPTX containing numbered questions, A)–D) options, and Answer: B lines.</small>
          <textarea id="modal-bulk-text" class="form-control" style="min-height: 180px; font-family: monospace; font-size: 0.85rem;" placeholder="The extracted quiz text will appear here for review." readonly></textarea>
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
      confirmText: 'Upload Quiz Questions',
      onConfirm: async () => {
        const rawText = document.getElementById('modal-bulk-text').value.trim();
        const mode = document.getElementById('modal-import-mode').value;

        if (!document.getElementById('modal-quiz-file')?.files?.length || !rawText) {
          App.toast('Choose a quiz file before importing questions.', 'warning');
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

  async readQuizFile(event, topicId) {
    const file = event.target.files?.[0];
    const status = document.getElementById('modal-quiz-file-status');
    const textarea = document.getElementById('modal-bulk-text');
    if (!file || !status || !textarea) return;
    textarea.value = '';

    this.startExtractionEstimate(file, 'modal-quiz-estimate');
    status.textContent = `Reading ${file.name}...`;
    try {
      let rawText = '';
      if (file.name.toLowerCase().endsWith('.txt')) {
        rawText = await file.text();
      } else {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        const extracted = await App.api('/api/extract-document', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, dataBase64: btoa(binary) })
        });
        rawText = extracted.text || '';
        if (extracted.format === 'PDF') {
          const imageText = await this.extractPdfImageText(file, message => {
            status.textContent = message;
            const progress = message.match(/page (\d+) of (\d+)/i);
            if (progress) this.renderExtractionEstimate(Number(progress[1]) / Number(progress[2]));
          });
          if (imageText) rawText += `\n${imageText}`;
        } else if (extracted.format === 'PowerPoint' && extracted.embeddedImages?.length) {
          const imageText = await this.extractEmbeddedImageText(extracted.embeddedImages, message => {
            status.textContent = message;
            const progress = message.match(/image (\d+) of (\d+)/i);
            if (progress) this.renderExtractionEstimate(Number(progress[1]) / Number(progress[2]));
          });
          if (imageText) rawText += `\n${imageText}`;
        }
      }

      textarea.value = rawText.replace(/^\[(?:Slide|Page)\s+\d+\]\s*/gmi, '').trim();
      status.textContent = `Loaded text from ${file.name}. Review its question and answer format before importing.${this.pdfOcrWarning ? ` ${this.pdfOcrWarning}` : ''}`;
      App.toast('Quiz file loaded. Review it, then upload its questions.', 'success');
    } catch (error) {
      status.textContent = error.message || 'Could not read this quiz file.';
      App.toast(status.textContent, 'danger');
    } finally {
      this.finishExtractionEstimate();
    }
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
