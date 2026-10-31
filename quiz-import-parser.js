const QUESTION_HEADER = /^(?:(?:question|q)\s*(\d{1,3})(?:[.)、:：\-–—]\s*|\s+)|(\d{1,3})\s*[.)、:：\-–—]\s*)(.*)$/i;
const OPTION_MARKER = /(?:^|\s)(?:\(([A-F])\)|([A-F])\s*[).:\-–—])\s*/gi;
const ANSWER_LINE = /(?:^|\s)(?:(?:correct\s+)?answer|ans(?:wer)?|correct\s+(?:option|choice))\s*(?::|=|[-–—]\s*|\bis\b)?\s*\(?([A-F]|\d{1,2})\)?[.)]?\s*$/i;

function parseQuizImportText(rawText) {
  const questions = [];
  let skippedCount = 0;
  let currentQuestion = null;

  const saveCurrentQuestion = () => {
    if (!currentQuestion) return;

    const labels = currentQuestion.options.map(option => option.label);
    const answerIndex = currentQuestion.answerLabel
      ? labels.indexOf(currentQuestion.answerLabel)
      : currentQuestion.answerNumber === null
        ? -1
        : currentQuestion.answerNumber === 0
          ? 0
          : currentQuestion.answerNumber - 1;
    const options = currentQuestion.options.map(option => option.text.trim()).filter(Boolean);

    if (!currentQuestion.question.trim() || options.length < 2 || options.length > 4 ||
        labels.some(label => !'ABCD'.includes(label)) ||
        labels.length !== options.length || new Set(labels).size !== labels.length ||
        !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
      skippedCount++;
      currentQuestion = null;
      return;
    }

    questions.push({
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      question: currentQuestion.question.trim(),
      options,
      correctAnswer: answerIndex,
      explanation: ''
    });
    currentQuestion = null;
  };

  const appendText = text => {
    const continuation = text.trim();
    if (!continuation || !currentQuestion) return;
    const lastOption = currentQuestion.options.at(-1);
    if (lastOption) lastOption.text = `${lastOption.text} ${continuation}`.trim();
    else currentQuestion.question = `${currentQuestion.question} ${continuation}`.trim();
  };

  const parseContent = line => {
    if (!currentQuestion || !line) return;

    const answerMatch = line.match(ANSWER_LINE);
    let content = line;
    if (answerMatch) {
      const answerValue = answerMatch[1];
      if (/^\d+$/.test(answerValue)) {
        currentQuestion.answerNumber = Number(answerValue);
        currentQuestion.answerLabel = null;
      } else {
        currentQuestion.answerLabel = answerValue.toUpperCase();
        currentQuestion.answerNumber = null;
      }
      content = line.slice(0, answerMatch.index).trim();
    }
    if (!content) return;

    OPTION_MARKER.lastIndex = 0;
    const markers = [];
    let marker;
    while ((marker = OPTION_MARKER.exec(content)) !== null) {
      markers.push({
        index: marker.index,
        end: OPTION_MARKER.lastIndex,
        label: (marker[1] || marker[2]).toUpperCase()
      });
    }

    if (!markers.length) {
      appendText(content);
      return;
    }

    appendText(content.slice(0, markers[0].index));
    markers.forEach((option, index) => {
      const end = markers[index + 1]?.index ?? content.length;
      const text = content.slice(option.end, end).trim();
      if (text) currentQuestion.options.push({ label: option.label, text });
    });
  };

  const lines = String(rawText || '')
    .replace(/\uFEFF/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const questionMatch = line.match(QUESTION_HEADER);
    if (questionMatch) {
      saveCurrentQuestion();
      currentQuestion = {
        question: '',
        options: [],
        answerLabel: null,
        answerNumber: null
      };
      parseContent(questionMatch[3]);
    } else {
      parseContent(line);
    }
  }
  saveCurrentQuestion();

  return { questions, skippedCount };
}

module.exports = { parseQuizImportText };
