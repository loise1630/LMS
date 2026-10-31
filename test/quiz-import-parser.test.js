const test = require('node:test');
const assert = require('node:assert/strict');
const { parseQuizImportText } = require('../quiz-import-parser');

test('parses numbered questions with the documented A) options and Answer format', () => {
  const parsed = parseQuizImportText([
    '1. Which service assigns IP addresses?',
    'A) DNS',
    'B) DHCP',
    'C) FTP',
    'Answer: B'
  ].join('\n'));

  assert.equal(parsed.questions.length, 1);
  assert.equal(parsed.questions[0].question, 'Which service assigns IP addresses?');
  assert.deepEqual(parsed.questions[0].options, ['DNS', 'DHCP', 'FTP']);
  assert.equal(parsed.questions[0].correctAnswer, 1);
  assert.equal(parsed.skippedCount, 0);
});

test('parses inline choices, alternate question headers, and answer wording', () => {
  const parsed = parseQuizImportText([
    'Question 1: Which component manages processes? A. Kernel B. Browser C. Editor Correct answer is (A)',
    'Q2) What does DNS resolve?',
    '(A) Hostnames',
    '(B) File permissions',
    'Correct option: A'
  ].join('\n'));

  assert.equal(parsed.questions.length, 2);
  assert.deepEqual(parsed.questions[0].options, ['Kernel', 'Browser', 'Editor']);
  assert.equal(parsed.questions[0].correctAnswer, 0);
  assert.equal(parsed.questions[1].question, 'What does DNS resolve?');
  assert.deepEqual(parsed.questions[1].options, ['Hostnames', 'File permissions']);
  assert.equal(parsed.questions[1].correctAnswer, 0);
});

test('joins wrapped question and option lines and accepts numeric answer indexes', () => {
  const parsed = parseQuizImportText([
    '1) Which command displays the',
    'current working directory?',
    'A - pwd command continued',
    'on a second line',
    'B - ls',
    'Answer - 1'
  ].join('\n'));

  assert.equal(parsed.questions.length, 1);
  assert.equal(parsed.questions[0].question, 'Which command displays the current working directory?');
  assert.deepEqual(parsed.questions[0].options, ['pwd command continued on a second line', 'ls']);
  assert.equal(parsed.questions[0].correctAnswer, 0);
});

test('imports lowercase choices and wrapped option text from the uploaded quiz format', () => {
  const parsed = parseQuizImportText([
    '1. What are emerging digital technologies?',
    'a. New and rapidly evolving digital',
    'innovations that transform society',
    'b. Printed communication materials',
    'c. Only computer hardware devices',
    'd. Old mechanical tools used in factories',
    'Answer: a',
    '2. Which of the following is NOT an example of',
    'emerging digital technologies?',
    'a. Artificial intelligence',
    'b. Blockchain',
    'c. Cloud computing',
    'd. Stone tools',
    'Correct Answer: d'
  ].join('\n'));

  assert.equal(parsed.questions.length, 2);
  assert.equal(parsed.questions[0].question, 'What are emerging digital technologies?');
  assert.deepEqual(parsed.questions[0].options, [
    'New and rapidly evolving digital innovations that transform society',
    'Printed communication materials',
    'Only computer hardware devices',
    'Old mechanical tools used in factories'
  ]);
  assert.equal(parsed.questions[0].correctAnswer, 0);
  assert.equal(parsed.questions[1].correctAnswer, 3);
  assert.equal(parsed.skippedCount, 0);
});

test('reports malformed questions as skipped without importing them', () => {
  const parsed = parseQuizImportText([
    '1. Has too few choices?',
    'A) Only one',
    'Answer: A',
    '2. Has an answer outside its choices?',
    'A) First',
    'B) Second',
    'Answer: D'
  ].join('\n'));

  assert.equal(parsed.questions.length, 0);
  assert.equal(parsed.skippedCount, 2);
});

test('rejects options and answer keys outside A through D', () => {
  const parsed = parseQuizImportText([
    '1. Which option is correct?',
    'A) First',
    'B) Second',
    'C) Third',
    'D) Fourth',
    'E) Fifth',
    'Answer: B',
    '2. Which option is correct?',
    'A) First',
    'B) Second',
    'Answer: E'
  ].join('\n'));

  assert.equal(parsed.questions.length, 0);
  assert.equal(parsed.skippedCount, 2);
});

test('does not mistake numbered prose for a question header', () => {
  const parsed = parseQuizImportText([
    '3 tiers of the operating system architecture.',
    'A heading without a question number.'
  ].join('\n'));

  assert.equal(parsed.questions.length, 0);
  assert.equal(parsed.skippedCount, 0);
});
