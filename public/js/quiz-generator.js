/**
 * ITPE PROJECT - Course Material OCR
 * 
 * Capabilities:
 * 1. OCR (Optical Character Recognition): Reads photos/images uploaded by the professor
 *    (textbook pages, lecture slides, formulas, and problem sets).
 */

const QuizGenerator = {
  generateQuestionsFromMaterial(materialText = '', desiredCount = 10) {
    const clean = value => value
      .normalize('NFKC')
      .replace(/[\uFFFD\u25A1\u25A0\u25A3-\u25A9]/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/^\s*(?:\[?(?:Page|Slide|Image)\s+\d+\]?\s*)/i, '')
      .replace(/^\s*[•*\-\d.)]+\s*/, '')
      .replace(/\b([a-z])and([a-z])\b/gi, '$1 and $2')
      .replace(/\band([a-z])\b/gi, 'and $1')
      .replace(/\s+/g, ' ')
      .trim();
    const isReadable = value => {
      if (!value || /[\uFFFD\u25A1\u25A0\u25A3-\u25A9]/.test(value)) return false;
      const lettersAndNumbers = (value.match(/[\p{L}\p{N}]/gu) || []).length;
      const tokens = value.split(/\s+/).filter(Boolean);
      return lettersAndNumbers >= 12 && tokens.length >= 3 && lettersAndNumbers / value.length >= 0.58;
    };
    const facts = [];
    const seen = new Set();
    const lines = String(materialText).split(/[\r\n]+/).flatMap(line =>
      line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    );
    for (const rawLine of lines) {
      if (/[\uFFFD\u25A1\u25A0\u25A3-\u25A9]/.test(rawLine)) continue;
      const line = clean(rawLine);
      const match = line.match(/^(.{2,100}?)\s+(?:is defined as|is|are|means|refers to|is called)\s+(.{15,240})$/i);
      if (!match) continue;
      const subject = clean(match[1]).replace(/^(?:the|a|an)\s+/i, '').replace(/[.:;]+$/, '');
      const definition = clean(match[2]).replace(/[.;]+$/, '');
      const subjectWords = subject.split(/\s+/);
      if (!isReadable(`${subject} ${definition}`) || subject.length < 4 || subjectWords.length > 8 ||
          /^(it|this|that|they|there|we|you|these|those|which|when|where|according)\b/i.test(subject) ||
          /(?:ing|ly)$/i.test(subject) || /\b(?:is|are|means|refers to|called)\b/i.test(subject)) continue;
      const key = `${subject.toLowerCase()}|${definition.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      facts.push({ subject, definition });
    }

    // Require enough readable concepts to build clear four-choice distractors.
    if (facts.length < 4) return [];
    return facts.slice(0, Math.min(desiredCount, 10)).map((fact, index) => {
      const distractors = [];
      for (let offset = 1; offset < facts.length && distractors.length < 3; offset++) {
        const other = facts[(index + offset) % facts.length];
        if (other.definition.toLowerCase() !== fact.definition.toLowerCase()) distractors.push(other.definition);
      }
      const options = [fact.definition, ...distractors];
      const correctAnswer = (index * 3) % options.length;
      const rotated = options.map((_, optionIndex) => options[(optionIndex - correctAnswer + options.length) % options.length]);
      return {
        id: `generated_${Date.now()}_${index}`,
        question: `According to the uploaded material, what best describes "${fact.subject}"?`,
        options: rotated,
        correctAnswer,
        explanation: `The uploaded material states: "${fact.subject} is ${fact.definition}."`,
        source: 'Uploaded material'
      };
    });
  },
  /**
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
      message: 'No OCR engine could read this image. Paste the lecture text into the notes box; no unrelated quiz questions were substituted.'
    };
  }
};

window.QuizGenerator = QuizGenerator;

