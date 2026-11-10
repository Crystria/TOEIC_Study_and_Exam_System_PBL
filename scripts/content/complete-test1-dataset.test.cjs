const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  completeDataset,
  auditDataset,
  documentText,
  PILOT,
  SUPPLEMENTAL,
} = require('./complete-test1-dataset.cjs');
const { validateDataset, canonical } = require('./import-toeic.cjs');
const editorial = require('./test1-editorial.cjs');
const root = 'data/toeic/ets-2023-test-01';
const exported = `${root}/source-extract-20261110`;
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const baseline = read(`${root}/dataset.json`);
const inputs = {
  questions: read(`${exported}/questions.json`),
  groups: read(`${exported}/groups.json`),
  images: read(`${exported}/image-mapping.json`),
  key: read(`${root}/answer-key.json`),
  solutionFile: path.join(
    'docs/TEST 1',
    fs.readdirSync('docs/TEST 1').find((n) => n.startsWith('1.7.')),
  ),
  readPassage: (p) => fs.readFileSync(path.join(exported, p), 'utf8'),
};
const completed = completeDataset(baseline, inputs, 'tmp/offline-test-evidence');
const q = (n) => completed.questions[n - 1];
const g = (n) => completed.groups.find((g) => g.questionNumbers[0] === n);

test('complete source content has 200 questions in order, 42 groups and the original TOEIC Part distribution', () => {
  const audit = auditDataset(completed, baseline);
  assert.deepEqual(audit.errors, []);
  assert.equal(audit.sourceTextReviewed, 200);
  assert.equal(audit.answersCrossChecked, 200);
  assert.equal(audit.transcriptOwners, 54);
});

test('pilot, supplemental, sourceIds, existing Learning and test records remain unchanged', () => {
  for (const n of [...PILOT, ...SUPPLEMENTAL]) assert.deepEqual(q(n), baseline.questions[n - 1]);
  for (const group of baseline.groups.filter((r) => r.quality.approved))
    assert.deepEqual(
      completed.groups.find((r) => r.sourceId === group.sourceId),
      group,
    );
  for (const key of ['topics', 'words', 'lessons', 'tests'])
    assert.deepEqual(completed[key], baseline[key]);
  assert.deepEqual(
    completed.questions.map((r) => r.sourceId),
    baseline.questions.map((r) => r.sourceId),
  );
  assert.deepEqual(
    completed.groups.map((r) => r.sourceId),
    baseline.groups.map((r) => r.sourceId),
  );
  assert.equal(validateDataset(completed, 'pilot', 'exam').valid, true);
  assert.equal(validateDataset(completed, 'supplemental', 'exam').valid, true);
});

test('every answer matches the independent answer-image transcription, including 154=D', () => {
  assert.deepEqual(
    completed.questions.map((r) => r.payload.correctOption),
    [...editorial.answerRows.join('')],
  );
  assert.equal(q(154).payload.correctOption, 'D');
  assert.equal(q(173).payload.correctOption, 'C');
});

test('Part 1/2 keep spoken content in transcript and expose only A-D or A-C in exam options', () => {
  for (let n = 1; n <= 31; n++) {
    const p = q(n).payload,
      codes = n <= 6 ? 'ABCD' : 'ABC';
    assert.equal(p.questionText, null);
    assert.equal(p.options.map((o) => o.optionText).join(''), codes);
    assert.equal([...p.transcript.matchAll(/\(([A-D])\)/g)].map((m) => m[1]).join(''), codes);
  }
  assert.match(q(16).payload.transcript, /company bus to the conference center/);
  assert.match(q(22).payload.transcript, /estimate in September/);
  assert.match(q(29).payload.transcript, /^Would you be able to delay the meeting\?/);
});

test('54 clips cover 100 Listening questions with one shared owner for each Part 3/4 group', () => {
  const audit = auditDataset(completed);
  assert.equal(audit.audioClips, 54);
  assert.equal(audit.listeningCoverage, 100);
  assert.equal(audit.images, 11);
  for (const group of completed.groups.filter((r) => r.payload.part <= 4)) {
    assert.equal(group.media.filter((m) => m.mediaType === 'AUDIO').length, 1);
    for (const n of group.questionNumbers)
      assert.equal((q(n).media || []).filter((m) => m.mediaType === 'AUDIO').length, 0);
  }
});

test('source text review cannot grant audio approval or make the full importer pass', () => {
  // Deliberately unapproved fixture: the live dataset can later be approved by a user.
  const unheard = structuredClone(baseline);
  for (const r of [...unheard.questions, ...unheard.groups]) {
    if (r.payload.part > 4 || r.batches.includes('pilot')) continue;
    r.quality.approved = false;
    r.quality.audioContentReviewed = false;
    for (const m of r.media || []) if (m.mediaType === 'AUDIO') m.contentReviewed = false;
  }
  const textOnly = completeDataset(unheard, inputs, 'tmp/unheard-fixture');
  assert.equal(auditDataset(textOnly).approvedQuestions, 108);
  assert.equal(auditDataset(textOnly).audioReviewed, 4);
  const validation = validateDataset(textOnly, 'all', 'exam');
  assert.equal(validation.valid, false);
  assert.equal(
    validation.errors.filter((e) => e.endsWith('listening content not verified')).length,
    92,
  );
  assert.equal(validation.errors.filter((e) => e.endsWith('media review pending')).length, 50);
  assert.deepEqual(
    validation.errors.filter(
      (e) =>
        !/editorial review pending|listening content not verified|media review pending/.test(e),
    ),
    [],
  );
  const tampered = structuredClone(textOnly);
  tampered.questions[7].quality.audioContentReviewed = true;
  assert(auditDataset(tampered, unheard).errors.some((e) => e.includes('audio approval changed')));
});

test('Part 6 blanks and Part 7 insertion positions are complete and ordered', () => {
  for (const group of completed.groups.filter((r) => r.payload.part === 6))
    assert.deepEqual(
      [...group.payload.passageText.matchAll(/\[\[(\d+)\]\]/g)].map((m) => m[1]),
      ['1', '2', '3', '4'],
    );
  for (const n of [169, 172])
    assert.deepEqual(
      [...g(n).payload.assets[0].content.matchAll(/\[(\d+)\]/g)].map((m) => m[1]),
      ['1', '2', '3', '4'],
    );
  const text = g(172).payload.assets[0].content;
  assert.match(text, /£999 starting price is £100 more/);
  assert.match(text, /£39, £59, and £79, respectively/);
});

test('forms, e-mail headers and triple-document order retain material source information', () => {
  assert.match(g(156).payload.assets[0].content, /\[x\] Repair/);
  assert.match(g(156).payload.assets[0].content, /Elenora Deckow/);
  const email = g(191).payload.assets[1].content;
  assert.match(email, /From: Keith Brandenberg <kbrandenberg@mailcurrent.com>\nDate: May 3/);
  assert.match(email, /Best regards,\n\nKeith Brandenberg$/);
  assert.match(g(191).payload.assets[2].content, /Wastewater \| Room 103/);
  const docs = g(196).payload.assets;
  assert.equal(docs.length, 3);
  assert.match(docs[0].content, /Famous Actor, First Book/);
  assert.match(docs[1].content, /To: Edith Hocking/);
  assert.match(docs[2].content, /From: Maria Cazalla/);
});

test('page-footer pollution is removed without modifying preserved pilot content', () => {
  assert.equal(q(33).payload.options[1].optionText, 'A line is very long.');
  assert.equal(
    q(100).payload.options[3].optionText,
    "The cost of a product's materials will rise soon.",
  );
  assert.equal(q(198).payload.options[3].optionText, 'To speak at a conference');
  assert(
    q(97).payload.options[3].optionText === baseline.questions[96].payload.options[3].optionText,
  );
});

test('offline completion can be run again without duplicating images or rewriting review evidence', () => {
  assert.equal(
    canonical(completeDataset(completed, inputs, 'tmp/different-evidence')),
    canonical(completed),
  );
});

test('auditor detects missing photos, broken group membership, blank order and document order', () => {
  const copy = structuredClone(completed);
  copy.questions[1].media = copy.questions[1].media.filter((m) => m.field !== 'imageKey');
  copy.questions[31].payload.positionInGroup = 3;
  copy.groups.find((r) => r.questionNumbers[0] === 135).payload.passageText =
    '[[1]] [[2]] [[2]] [[4]]';
  copy.groups.find((r) => r.questionNumbers[0] === 196).payload.assets[0].orderNo = 2;
  const errors = auditDataset(copy).errors;
  for (const kind of ['photo', 'group position', 'blank order', 'document order'])
    assert(
      errors.some((e) => e.includes(kind)),
      kind,
    );
});

test('unrecognized passage layouts fail instead of inserting unreviewed OCR into payloads', () => {
  assert.throws(() => documentText('unknown-document', 'Raw OCR'), /No editorial rule/);
});
