/**
 * ITPE PROJECT - Course Material OCR
 * 
 * Capabilities:
 * 1. OCR (Optical Character Recognition): Reads photos/images uploaded by the professor
 *    (textbook pages, lecture slides, formulas, and problem sets).
 */

const QuizGenerator = {
  generateQuestionsFromMaterial(materialText = '', desiredCount = 10) {
    const clean = value => String(value || '')
      .normalize('NFKC')
      .replace(/[\uFFFD\u25A1\u25A0\u25A3-\u25A9]/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/^\s*(?:\[?(?:Page|Slide|Image)\s+\d+\]?\s*)/i, '')
      .replace(/^\s*(?:[\u2022\u25CF\u25AA\u25E6*\-]|\d{1,3}[.)])\s*/, '')
      .replace(/\b([a-z])and([a-z])\b/gi, '$1 and $2')
      .replace(/\band([a-z])\b/gi, 'and $1')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/[.;:]+$/, '')
      .trim();
    const wordCount = value => value.split(/\s+/).filter(Boolean).length;
    const readable = value => {
      const chars = [...value].filter(char => /[\p{L}\p{N}]/u.test(char)).length;
      return value.length >= 20 && wordCount(value) >= 4 && chars / value.length >= 0.62 &&
        !/[\uFFFD\u25A1\u25A0\u25A3-\u25A9]/.test(value);
    };
    const sentences = String(materialText).split(/[\r\n]+/)
      .flatMap(line => line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
      .map(clean)
      .filter(sentence => sentence.length >= 25 && sentence.length <= 360 && readable(sentence));
    const facts = [];
    const seen = new Set();
    const addFact = (subjectValue, answerValue, kind, evidence) => {
      const subject = clean(subjectValue).replace(/^(?:the|a|an)\s+/i, '').replace(/[.:;]+$/, '');
      const answer = clean(answerValue);
      if (subject.length < 3 || wordCount(subject) > 8 || answer.length < 15 || answer.length > 240 ||
          /^(it|this|that|they|there|we|you|these|those|which|when|where|according)\b/i.test(subject) ||
          /\b(?:is|are|means|refers to|defined as|is called)$/i.test(subject) || !readable(`${subject} ${answer}`)) return;
      const key = `${subject.toLowerCase()}|${answer.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      facts.push({ subject, answer, kind, evidence: clean(evidence) });
    };

    for (const sentence of sentences) {
      const definition = sentence.match(/^(.{2,90}?)\s+(?:is defined as|refers to|means|is called|is(?! used to\b)|are)\s+(.{15,240})$/i);
      if (definition) {
        addFact(definition[1], definition[2], 'definition', sentence);
        continue;
      }
      const purpose = sentence.match(/^(.{2,90}?)\s+(is used to|helps? to)\s+(.{12,200})$/i);
      if (purpose) {
        addFact(purpose[1], purpose[3], 'purpose', sentence);
        continue;
      }

      const functionFact = sentence.match(/^(.{2,90}?)\s+(monitors|manages|controls|protects|stores|connects|communicates with|encrypts|validates|schedules|allocates|transfers|filters|detects|records|installs|configures|maintains|diagnoses|resolves|provides|contains|includes|consists of)\s+(.{12,200})$/i);
      if (functionFact) addFact(functionFact[1], `${functionFact[2]} ${functionFact[3]}`, 'function', sentence);
    }

    // Lecture notes often present concepts as "Term: explanation".
    for (const rawLine of String(materialText).split(/[\r\n]+/)) {
      const line = clean(rawLine);
      const pair = line.match(/^([^:]{2,75}):\s*(.{20,220})$/);
      if (pair && readable(pair[2])) addFact(pair[1], pair[2], 'definition', line);
    }
    if (facts.length < 4) return [];

    const limit = Math.max(1, Math.min(Number(desiredCount) || 10, 50));
    const normalizeAnswer = value => clean(value).toLowerCase()
      .replace(/^(?:a|an|the)\s+/, '').replace(/[^\p{L}\p{N}]+/gu, ' ');
    const buildOptions = (fact, index, mode) => {
      const answer = mode === 'term' ? fact.subject : fact.answer;
      const candidates = facts
        .filter((other, otherIndex) => otherIndex !== index)
        .map(other => mode === 'term' ? other.subject : other.answer)
        .filter(option => normalizeAnswer(option) !== normalizeAnswer(answer));
      const answerLength = wordCount(answer);
      candidates.sort((a, b) => {
        const score = value => Math.abs(wordCount(value) - answerLength) +
          Math.abs(value.length - answer.length) / Math.max(answer.length, 1);
        return score(a) - score(b);
      });
      const options = [answer];
      for (const candidate of candidates) {
        if (options.every(option => normalizeAnswer(option) !== normalizeAnswer(candidate))) options.push(candidate);
        if (options.length === 4) break;
      }
      if (options.length < 4) return null;
      const correctAnswer = (index * 3 + 1) % 4;
      const arranged = options.slice(1);
      arranged.splice(correctAnswer, 0, answer);
      return { options: arranged, correctAnswer };
    };

    return facts.slice(0, limit).flatMap((fact, index) => {
      const useTermChoices = fact.kind === 'purpose' || (fact.kind === 'definition' && index % 2 === 0);
      const choices = buildOptions(fact, index, useTermChoices ? 'term' : 'answer');
      if (!choices) return [];
      let question;
      if (fact.kind === 'purpose') {
        question = `A technician needs to ${fact.answer}. Which concept from the material is designed for this task?`;
      } else if (fact.kind === 'function') {
        question = `What role does "${fact.subject}" play, according to the material?`;
      } else if (useTermChoices) {
        question = `Which concept is best described by this statement: “${fact.answer}”?`;
      } else {
        question = `What does “${fact.subject}” mean in the uploaded material?`;
      }
      return [{
        id: `generated_${Date.now()}_${index}`,
        question,
        options: choices.options,
        correctAnswer: choices.correctAnswer,
        explanation: `Source: “${fact.evidence}.”`,
        source: 'Uploaded material'
      }];
    });
  },  /**
   * Run OCR on an uploaded image file or base64 data.
   * Uses Tesseract.js in the browser when it is available.
   */
  async extractTextFromImage(imageFileOrBase64, onProgress = null) {
    // 1. Try browser Tesseract.js if available
    if (typeof Tesseract !== 'undefined') {
      let worker = null;
      try {
        if (onProgress) onProgress(10, 'Initializing OCR recognition worker...');

        worker = await Tesseract.createWorker('eng', 1, {
          logger: m => {
            if (m.status === 'recognizing text' && onProgress) {
              const pct = Math.round(m.progress * 100);
              onProgress(Math.min(95, Math.max(15, pct)), `Scanning document & mathematical symbols... ${pct}%`);
            }
          }
        });

        const ret = await worker.recognize(imageFileOrBase64);

        const extractedText = (ret && ret.data && ret.data.text) ? ret.data.text.trim() : '';
        if (onProgress) onProgress(100, 'OCR Scan Complete!');

        if (extractedText.length > 10) {
          return {
            success: true,
            text: extractedText,
            confidence: ret.data.confidence || 85,
            engine: 'Tesseract.js OCR Engine'
          };
        }
      } catch (ocrErr) {
        console.warn('Tesseract.js OCR could not read this image:', ocrErr);
      } finally {
        if (worker) await worker.terminate();
      }
    }

    return {
      success: false,
      text: '',
      confidence: 0,
      engine: 'OCR unavailable',
      message: 'No OCR engine could read this image. Try another image or upload your own quiz file.'
    };
  }
};

window.QuizGenerator = QuizGenerator;

