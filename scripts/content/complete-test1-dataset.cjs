/* Offline, non-destructive completion of TEST 1. Never calls an API or changes a checkpoint. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { parseArgs } = require('node:util');
const { canonical, hash, saveAtomic, validateDataset } = require('./import-toeic.cjs');
const editorial = require('./test1-editorial.cjs');
const ROOT = 'data/toeic/ets-2023-test-01';
const EXPORT = `${ROOT}/source-extract-20261110`;
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const flat = (s) => s.replace(/\s+/g, ' ').trim();
const PILOT = [
  1, 7, 62, 63, 64, 95, 96, 97, 101, 102, 103, 131, 132, 133, 134, 186, 187, 188, 189, 190,
];
const SUPPLEMENTAL = [147, 148, 176, 177, 178, 179, 180];

function documentText(assetId, raw) {
  if (editorial.documents[assetId]) return editorial.documents[assetId];
  let text = raw
    .replace(/\r/g, '')
    .trim()
    .split(/\n\s*\n/)
    .map(flat)
    .join('\n\n');
  if (assetId === 'g151-153-document-1') {
    for (const start of [
      'Already contracted',
      'Tillford vice president',
      'Tillford Press is based',
    ])
      text = text.replace(new RegExp(`\\s+(${start})`), '\n\n$1');
  } else if (assetId === 'g154-155-document-1') {
    text = text
      .replace('When 1 push', 'When I push')
      .replace(/\s+(?=(?:Greg Skagen|Brenda Sadauskas) \()/g, '\n\n');
  } else if (assetId === 'g158-161-document-1') {
    text = text.replace(
      /\s+(?=(?:Ella Glatt|Stef Goldberg|Daniel Seidal|Bill Iverman) \()/g,
      '\n\n',
    );
  } else if (assetId === 'g166-168-document-1') {
    text = text.replace(
      'https://trexdale.com/aboutus About Our Company ',
      'https://trexdale.com/aboutus\n\n# About Our Company\n\n',
    );
    for (const start of ['Our business offers', 'Please visit'])
      text = text.replace(new RegExp(`\\s+(${start})`), '\n\n$1');
  } else if (assetId === 'g181-185-document-1') {
    text = text.replace(
      /^\*E-mail\* To: Linda Hanshu From: Cliff Merson Subject: Li htin Issue Date: Se tember 4, 10:12 A.M. /,
      'To: Linda Hanshu\nFrom: Cliff Merson\nSubject: Lighting Issue\nDate: September 4, 10:12 A.M.\n\n',
    );
    text = text.replace('problemfthat', 'problem that');
    for (const start of [
      'I want to check',
      'All other aspects',
      'Regards,',
      'Cliff Merson Project Manager',
    ])
      text = text.replace(new RegExp(`\\s+(${start})`), '\n\n$1');
    text = text.replace('Cliff Merson Project Manager', 'Cliff Merson\nProject Manager');
  } else if (assetId === 'g181-185-document-2') {
    text = text
      .replace(
        "Review of Titan Adventure: Neptune's Voyage By Leo Weber, April 1 ",
        "# Review of Titan Adventure: Neptune's Voyage\n\nBy Leo Weber, April 1\n\n",
      )
      .replace(/\s+(Neptune's Voyage launches)/, '\n\n$1');
  } else if (assetId === 'g191-195-document-1') {
    text = text
      .replace('Instructions for Requesting Records ', '# Instructions for Requesting Records\n\n')
      .replace(' l. Create', '\n\n1. Create')
      .replace(/\s+(?=[234]\. (?:Use|The department|If there))/g, '\n\n');
  } else if (assetId === 'g191-195-document-2') {
    const start = text.indexOf('Dear Ms. Park,');
    assert(start >= 0, 'Missing records-request e-mail body');
    let body = text.slice(start);
    for (const start of [
      'Thank you for confirming',
      'I have a question',
      'Please clarify',
      'Best regards,',
      'Keith Brandenberg',
    ])
      body = body.replace(new RegExp(`\\s+(${start})`), '\n\n$1');
    text =
      'To: Joo-Hee Park <jhpark@coa.net>\nFrom: Keith Brandenberg <kbrandenberg@mailcurrent.com>\nDate: May 3\nSubject: RE: Reference number W2486\n\n' +
      body;
  } else if (assetId === 'g196-200-document-1') {
    text = text.replace('Famous Actor, First Book ', '# Famous Actor, First Book\n\n');
    for (const start of ['In his book,', 'Mr. Eklund has long', '—Uma Joshi'])
      text = text.replace(new RegExp(`\\s+(${start})`), '\n\n$1');
  } else throw Error(`No editorial rule for ${assetId}`);
  return text;
}

function solutionPages(n) {
  if (n <= 5) return [1];
  if (n <= 12) return [2];
  if (n === 13) return [2, 3];
  if (n <= 21) return [3];
  if (n === 22) return [3, 4];
  if (n <= 28) return [4];
  if (n === 29) return [4, 5];
  if (n <= 31) return [5];
  throw Error('Grouped Listening uses conversation page references');
}

function completeDataset(input, inputs, evidence) {
  const d = structuredClone(input);
  assert.equal(d.datasetId, 'ets-2023-test-01');
  const manualKey = editorial.answerRows.join('');
  assert.equal(manualKey.length, 200);
  assert.deepEqual(
    inputs.key.map((a) => a.correctOption),
    [...manualKey],
    'Answer image/key disagree',
  );
  const original = new Map(input.questions.map((q) => [q.questionNumber, q]));
  const protectedQuestions = new Set([...PILOT, ...SUPPLEMENTAL]);
  const solutionFile = inputs.solutionFile;
  const addSource = (r, pages) => {
    if (!r.source.some((s) => s.file === solutionFile))
      r.source.push({
        file: solutionFile,
        pdfPages: pages,
        pageNumbering: '1-based PDF',
        purpose: 'Printed transcript; recording approval is separate',
      });
  };
  const image = (owner, a, field) => ({
    sourceId: `${owner.sourceId}-${field === 'imageKey' ? 'image' : 'graphic'}`,
    file: path.join(EXPORT, a.imageFile),
    sha256: a.sha256,
    mediaType: 'IMAGE',
    contentType: 'image/png',
    field,
    orderNo: a.documentOrder,
    contentReviewed: true,
    reviewEvidence: `${evidence}/source-review.json`,
    sourceAssetId: a.assetId,
  });
  for (const q of d.questions) {
    if (
      protectedQuestions.has(q.questionNumber) ||
      q.quality.normalizationSource === 'test1-editorial-20261110'
    )
      continue;
    const n = q.questionNumber,
      source = inputs.questions.find((s) => s.questionNumber === n);
    assert.equal(source.sourceId, q.sourceId);
    assert.equal(q.payload.correctOption, manualKey[n - 1]);
    assert(editorial.answerReasons[n], `Missing independent answer rationale ${n}`);
    if (n <= 31) {
      const [prompt, ...statements] = editorial.spoken[n];
      assert.equal(statements.length, n <= 6 ? 4 : 3);
      q.payload.questionText = null;
      q.payload.options = statements.map((_, i) => ({
        optionCode: 'ABCD'[i],
        optionText: 'ABCD'[i],
      }));
      q.payload.transcript = [prompt, ...statements.map((s, i) => `(${'ABCD'[i]}) ${s}`)]
        .filter(Boolean)
        .join('\n');
      addSource(q, solutionPages(n));
      if (n <= 6) {
        const photo = inputs.images.find(
          (a) => a.role === 'QUESTION_PHOTO' && a.questionNumbers.includes(n),
        );
        assert(photo, `Missing photo ${n}`);
        if (!q.media.some((m) => m.field === 'imageKey')) q.media.push(image(q, photo, 'imageKey'));
      }
    } else {
      q.payload.questionText =
        q.payload.part === 6
          ? `Choose the best answer for blank ${n}.`
          : flat(source.printedQuestionText);
      q.payload.options = source.printedOptions.map((o) => ({
        ...o,
        optionText: flat(o.optionText),
      }));
      const edit = editorial.questionEdits[n];
      if (edit?.questionText) q.payload.questionText = edit.questionText;
      for (const o of q.payload.options)
        if (edit?.options?.[o.optionCode]) o.optionText = edit.options[o.optionCode];
    }
    q.payload.explanation = `${q.payload.correctOption}: ${editorial.answerReasons[n]}`;
    q.batches = [...new Set([...(q.batches || []), 'full-content'])];
    q.quality = {
      ...q.quality,
      approved: q.payload.part >= 5,
      textReviewed: true,
      answerCrossChecked: true,
      ...(q.payload.part <= 4 ? { transcriptTextReviewed: true } : {}),
      evidence: `${evidence}/source-review.json`,
      normalizationSource: 'test1-editorial-20261110',
      review:
        q.payload.part <= 4
          ? 'Original exam/printed solution transcript/answer image checked; MP3 listening approval remains pending'
          : 'Original PDF text, options, passage and answer image independently checked',
      notes:
        q.payload.part <= 4
          ? ['Recording content still requires listening approval; text review does not grant it']
          : [],
    };
  }
  for (const g of d.groups) {
    if (g.quality.approved || g.quality.normalizationSource === 'test1-editorial-20261110')
      continue;
    const first = g.questionNumbers[0],
      part = g.payload.part;
    const source = inputs.groups.find((s) => s.sourceId === g.sourceId);
    assert(source);
    if (part <= 4) {
      const [pages, transcript] = editorial.conversations[first];
      g.payload.transcript = transcript;
      addSource(g, pages);
      for (const q of d.questions.filter((q) => q.groupSourceId === g.sourceId))
        addSource(q, pages);
      const graphic = inputs.images.find(
        (a) => a.role === 'LISTENING_GRAPHIC' && a.questionNumbers.includes(first),
      );
      if (graphic && !g.media.some((m) => m.mediaType === 'IMAGE'))
        g.media.push(image(g, graphic, 'asset'));
    } else if (part === 6) {
      assert(editorial.part6[first]);
      g.payload.passageText = editorial.part6[first];
    } else {
      assert.equal(source.documents.length, g.documentCount);
      g.payload.assets = [...source.documents]
        .sort((a, b) => a.order - b.order)
        .map((a) => ({
          kind: 'TEXT',
          orderNo: a.order,
          content: documentText(a.assetId, inputs.readPassage(a.rawOcrTextFile)),
        }));
    }
    if (part >= 6) {
      g.sourceDocuments = source.documents.map((a) => {
        const crop = inputs.images.find((m) => m.assetId === a.assetId);
        return {
          assetId: a.assetId,
          orderNo: a.order,
          imageFile: path.join(EXPORT, a.imageFile),
          sha256: crop.sha256,
          sourcePdf: crop.sourcePdf,
          pdfPage: crop.pdfPage,
          role: 'Source reference only; rendered passage is TEXT',
        };
      });
    }
    g.batches = [...new Set([...(g.batches || []), 'full-content'])];
    g.quality = {
      ...g.quality,
      approved: part >= 6,
      textReviewed: true,
      ...(part <= 4
        ? { transcriptTextReviewed: true, audioContentReviewed: false }
        : { documentOrderReviewed: true }),
      evidence: `${evidence}/source-review.json`,
      uiReviewed: false,
      normalizationSource: 'test1-editorial-20261110',
      notes: part <= 4 ? ['Printed transcript reviewed; MP3 listening approval pending'] : [],
    };
    if (first === 53)
      g.quality.sourceAnomalies = [
        'Printed solution uses "wafer damage"; confirm wording against MP3 before audio approval.',
      ];
    if (first === 143)
      g.quality.sourceAnomalies = [
        'Original PDF prints "add money their accounts" without "to"; preserved verbatim.',
      ];
  }
  for (const n of protectedQuestions)
    assert.equal(
      canonical(d.questions[n - 1]),
      canonical(original.get(n)),
      `Protected question ${n} changed`,
    );
  return d;
}

function auditDataset(d, baseline) {
  const errors = [],
    check = (ok, message) => {
      if (!ok) errors.push(message);
    };
  check(
    d.questions.length === 200 && new Set(d.questions.map((q) => q.sourceId)).size === 200,
    '200 unique questions required',
  );
  check(
    d.groups.length === 42 && new Set(d.groups.map((g) => g.sourceId)).size === 42,
    '42 unique groups required',
  );
  check(
    canonical(d.questions.map((q) => q.questionNumber)) ===
      canonical(Array.from({ length: 200 }, (_, i) => i + 1)),
    'Source order 1..200 required',
  );
  check(
    canonical(
      [1, 2, 3, 4, 5, 6, 7].map((p) => d.questions.filter((q) => q.payload.part === p).length),
    ) === canonical([6, 25, 39, 30, 30, 16, 54]),
    'Part distribution mismatch',
  );
  const audio = new Map();
  for (const q of d.questions) {
    const p = q.payload,
      codes = p.part === 2 ? 'ABC' : 'ABCD';
    check(
      p.options.map((o) => o.optionCode).join('') === codes &&
        p.options.every((o) => o.optionText.trim()),
      `${q.sourceId}: choices`,
    );
    check(codes.includes(p.correctOption), `${q.sourceId}: key`);
    check(
      q.quality.textReviewed && q.quality.answerCrossChecked,
      `${q.sourceId}: source text/key not reviewed`,
    );
    if (p.part <= 2) {
      check(
        p.questionText === null && p.options.every((o) => o.optionText === o.optionCode),
        `${q.sourceId}: spoken answers leaked into exam`,
      );
      check(
        !!p.transcript &&
          [...p.transcript.matchAll(/\(([A-D])\)/g)].map((m) => m[1]).join('') === codes,
        `${q.sourceId}: transcript choices`,
      );
    } else check(!!p.questionText?.trim(), `${q.sourceId}: question text`);
    const g = d.groups.find((g) => g.sourceId === q.groupSourceId);
    if (p.part <= 4) {
      const clip = [...(q.media || []), ...(g?.media || [])].find((m) => m.field === 'audioKey');
      check(!!clip, `${q.sourceId}: audio mapping`);
      if (clip) audio.set(q.questionNumber, clip.sourceId);
      check(!!(p.transcript || g?.payload.transcript), `${q.sourceId}: missing transcript`);
    }
    if (p.part === 1)
      check(
        q.media.some((m) => m.field === 'imageKey'),
        `${q.sourceId}: photo`,
      );
    if ([3, 4, 6, 7].includes(p.part))
      check(
        !!g && g.questionNumbers[p.positionInGroup - 1] === q.questionNumber,
        `${q.sourceId}: group position`,
      );
    check(
      !/the Listening test\.|back to Parts|This is the end of/.test(JSON.stringify(p.options)),
      `${q.sourceId}: page footer in option`,
    );
  }
  for (const g of d.groups) {
    const p = g.payload;
    if (p.part <= 4) check(!!p.transcript?.trim(), `${g.sourceId}: transcript`);
    if (p.part === 6)
      check(
        [...p.passageText.matchAll(/\[\[(\d+)\]\]/g)].map((m) => m[1]).join('') === '1234',
        `${g.sourceId}: blank order`,
      );
    if (p.part === 7)
      check(
        p.assets.length === g.documentCount &&
          p.assets.every((a, i) => a.kind === 'TEXT' && a.content.trim() && a.orderNo === i + 1),
        `${g.sourceId}: document order`,
      );
    for (const m of g.sourceDocuments || [])
      check(
        fs.existsSync(m.imageFile) && hash(fs.readFileSync(m.imageFile)) === m.sha256,
        `${g.sourceId}: source document hash`,
      );
  }
  check(
    audio.size === 100 && new Set(audio.values()).size === 54,
    '54 shared clips must cover 100 Listening questions',
  );
  const media = [...d.questions, ...d.groups].flatMap((r) => r.media || []);
  check(new Set(media.map((m) => m.sourceId)).size === media.length, 'Duplicate media sourceId');
  for (const m of media)
    check(
      fs.existsSync(m.file) && hash(fs.readFileSync(m.file)) === m.sha256,
      `${m.sourceId}: file/hash`,
    );
  if (baseline) {
    for (const key of [
      'schemaVersion',
      'datasetId',
      'usage',
      'topics',
      'words',
      'lessons',
      'tests',
    ])
      check(canonical(d[key]) === canonical(baseline[key]), `${key} changed`);
    for (const n of [...PILOT, ...SUPPLEMENTAL])
      check(
        canonical(d.questions[n - 1]) === canonical(baseline.questions[n - 1]),
        `Protected question ${n} changed`,
      );
    for (const g of baseline.groups.filter((g) => g.quality.approved))
      check(
        canonical(d.groups.find((v) => v.sourceId === g.sourceId)) === canonical(g),
        `Protected group ${g.sourceId} changed`,
      );
    check(
      canonical(d.questions.map((q) => q.sourceId)) ===
        canonical(baseline.questions.map((q) => q.sourceId)),
      'Question sourceIds changed',
    );
    check(
      canonical(d.groups.map((g) => g.sourceId)) ===
        canonical(baseline.groups.map((g) => g.sourceId)),
      'Group sourceIds changed',
    );
    for (const q of d.questions.filter((q) => q.payload.part <= 4))
      check(
        q.quality.audioContentReviewed ===
          baseline.questions[q.questionNumber - 1].quality.audioContentReviewed,
        `${q.sourceId}: audio approval changed`,
      );
  }
  return {
    valid: errors.length === 0,
    errors,
    questions: d.questions.length,
    groups: d.groups.length,
    sourceTextReviewed: d.questions.filter((q) => q.quality.textReviewed).length,
    answersCrossChecked: d.questions.filter((q) => q.quality.answerCrossChecked).length,
    approvedQuestions: d.questions.filter((q) => q.quality.approved).length,
    transcriptOwners: [...d.questions, ...d.groups].filter((r) => r.payload.transcript).length,
    audioClips: new Set(audio.values()).size,
    listeningCoverage: audio.size,
    images: media.filter((m) => m.mediaType === 'IMAGE').length,
    audioReviewed: media.filter((m) => m.mediaType === 'AUDIO' && m.contentReviewed).length,
    tests: d.tests.length,
  };
}

function main() {
  const { values: o } = parseArgs({
    options: { out: { type: 'string' }, apply: { type: 'boolean', default: false } },
  });
  assert(o.out && !fs.existsSync(o.out), 'Choose a new --out directory');
  const before = read(`${ROOT}/dataset.json`);
  const unchanged = [
    'answer-key.json',
    'source-inventory.json',
    'review-queue.json',
    'import-state.local.json',
  ];
  const hashes = Object.fromEntries(
    unchanged.map((n) => [n, hash(fs.readFileSync(`${ROOT}/${n}`))]),
  );
  const inputs = {
    questions: read(`${EXPORT}/questions.json`),
    groups: read(`${EXPORT}/groups.json`),
    images: read(`${EXPORT}/image-mapping.json`),
    key: read(`${ROOT}/answer-key.json`),
    solutionFile: fs
      .readdirSync('docs/TEST 1')
      .filter((n) => n.startsWith('1.7.'))
      .map((n) => path.join('docs/TEST 1', n))[0],
    readPassage: (p) => fs.readFileSync(path.join(EXPORT, p), 'utf8'),
  };
  const completed = completeDataset(before, inputs, o.out.replaceAll('\\', '/'));
  const audit = auditDataset(completed, before);
  assert(audit.valid, audit.errors.join('\n'));
  fs.mkdirSync(o.out, { recursive: true });
  saveAtomic(path.join(o.out, 'dataset-before.json'), before);
  saveAtomic(path.join(o.out, 'dataset-candidate.json'), completed);
  const sourceReview = {
    at: new Date().toISOString(),
    method:
      'Manual comparison of all original exam content pages, answer image, and all 27 English transcript pages; existing coordinate OCR reused',
    originalExamPages: {
      listening: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      reading: Array.from({ length: 30 }, (_, i) => i + 2),
    },
    printedSolutionPages: { listening: Array.from({ length: 27 }, (_, i) => i + 1) },
    updatedQuestions: completed.questions
      .filter((q, i) => canonical(q) !== canonical(before.questions[i]))
      .map((q) => q.questionNumber),
    updatedGroups: completed.groups
      .filter((g, i) => canonical(g) !== canonical(before.groups[i]))
      .map((g) => g.sourceId),
    answerImageTranscription: [...editorial.answerRows.join('')].map((correctOption, i) => ({
      questionNumber: i + 1,
      correctOption,
    })),
    answerRationales: editorial.answerReasons,
    preservedQuestions: [...PILOT, ...SUPPLEMENTAL],
    limitations: [
      'No MP3 was listened to in this operation; all prior audio approval flags retained',
      'Original source typos retained where explicitly recorded',
      'No UI acceptance, database import, upload, Full Test creation or checkpoint change',
    ],
    corrections: [
      'Q33: Aline -> A line',
      'Q100/Q198: remove unrelated footer text from option D',
      'Q161: repair time spacing',
      'Part 6: restore four numbered blanks per group',
      'Q171/Q175: restore all four insertion positions',
      'G172: restore £100 price difference, £ symbols and column order',
      'Repair missing e-mail metadata and checked Repair box; retain source document order',
    ],
  };
  saveAtomic(path.join(o.out, 'source-review.json'), sourceReview);
  const importer = validateDataset(completed, 'all', 'exam');
  const unanticipated = importer.errors.filter(
    (e) => !/editorial review pending|listening content not verified|media review pending/.test(e),
  );
  assert.deepEqual(unanticipated, [], 'Importer found a non-audio blocker');
  saveAtomic(path.join(o.out, 'validation.json'), {
    ...audit,
    fullImportReady: importer.valid,
    importerErrors: importer.errors,
  });
  for (const [n, h] of Object.entries(hashes))
    assert.equal(hash(fs.readFileSync(`${ROOT}/${n}`)), h, `${n} changed during completion`);
  if (o.apply) {
    assert.equal(hash(read(`${ROOT}/dataset.json`)), hash(before), 'Dataset changed concurrently');
    saveAtomic(`${ROOT}/dataset.json`, completed);
  }
  saveAtomic(path.join(o.out, 'preservation.json'), {
    unchangedHashes: hashes,
    pilotQuestionsUnchanged: 20,
    supplementalQuestionsUnchanged: 7,
    protectedGroupsUnchanged: before.groups.filter((g) => g.quality.approved).length,
    sourceIdsUnchanged: true,
    learningUnchanged: true,
    audioApprovalsUnchanged: true,
    checkpointUnchanged: true,
    datasetBeforeSha256: hash(before),
    datasetAfterSha256: hash(completed),
    applied: o.apply,
  });
  console.log(
    JSON.stringify(
      { out: o.out, applied: o.apply, ...audit, fullImportReady: importer.valid },
      null,
      2,
    ),
  );
}

module.exports = {
  completeDataset,
  auditDataset,
  documentText,
  solutionPages,
  PILOT,
  SUPPLEMENTAL,
};
if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
