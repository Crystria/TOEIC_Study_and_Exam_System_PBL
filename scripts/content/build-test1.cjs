/* Assemble reviewed pilot text and original learning content; never approve raw OCR. */
const fs = require('node:fs'),
  path = require('node:path'),
  zlib = require('node:zlib');
const { hash, saveAtomic } = require('./import-toeic.cjs');
const root = 'data/toeic/ets-2023-test-01';
const evidence = process.argv[2];
if (!evidence) throw Error('Usage: node scripts/content/build-test1.cjs <evidence-directory>');
const sourceRoot = 'docs/TEST 1',
  files = fs.readdirSync(sourceRoot);
const fileFor = (code) =>
  path.join(
    sourceRoot,
    files.find((f) => f.startsWith(code[0] + '.' + code[1] + '.')),
  );
const source = (code, pages, extra = {}) => ({
  file: fileFor(code),
  pdfPages: Array.isArray(pages) ? pages : [pages],
  pageNumbering: '1-based PDF',
  ...extra,
});
const qid = (n) => `ets-2023-test-01-q${String(n).padStart(3, '0')}`;
const gid = (a, b) => `ets-2023-test-01-g${a}-${b}`;
const pilot = [
  1, 7, 62, 63, 64, 95, 96, 97, 101, 102, 103, 131, 132, 133, 134, 186, 187, 188, 189, 190,
];
const pages = [];
for (const code of ['11', '12', '17', '18', '19'])
  for (const name of fs
    .readdirSync(path.join(evidence, 'ocr', code))
    .filter((f) => f.endsWith('.ocr.json'))
    .sort()) {
    const j = JSON.parse(
      fs.readFileSync(path.join(evidence, 'ocr', code, name), 'utf8').replace(/^\uFEFF/, ''),
    );
    pages.push({ code, pdfPage: +name.match(/\d+/)[0], ...j });
  }
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, 'ocr-pages.json.gz'), zlib.gzipSync(JSON.stringify(pages)));
const textOf = (p) => p.lines.map((l) => l.text).join('\n');
const clean = (s) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[-–—]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim();
const topics = [
  ['office', 'TEST 1 - Văn phòng và công việc'],
  ['careers', 'TEST 1 - Tuyển dụng và kỹ năng'],
  ['services', 'TEST 1 - Dịch vụ và cửa hàng'],
  ['travel', 'TEST 1 - Đi lại và tham quan'],
  ['media', 'TEST 1 - Truyền thông và phát thanh'],
].map(([key, topicName]) => ({
  sourceId: `ets-2023-test-01-topic-${key}`,
  kind: 'topic',
  batches: key === 'office' ? ['pilot'] : [],
  payload: { topicName },
  source: [
    source(
      '12',
      key === 'office'
        ? 2
        : key === 'careers'
          ? 27
          : key === 'services'
            ? 5
            : key === 'travel'
              ? 26
              : 26,
    ),
  ],
  quality: { approved: true, review: 'Editorially selected topic; local project use' },
}));
const wordLines = fs
  .readFileSync(path.join(root, 'vocabulary.tsv'), 'utf8')
  .trim()
  .split(/\r?\n/)
  .slice(1);
const words = wordLines.map((line, i) => {
  const [topic, word, partOfSpeech, sense, example, code, page, sourceTerm] = line.split('|');
  const p = pages.find((p) => p.code === code && p.pdfPage === +page);
  const found = p && clean(textOf(p)).includes(clean(sourceTerm));
  const slug = word
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  return {
    sourceId: `ets-2023-test-01-word-${slug}`,
    kind: 'word',
    batches: i < 20 ? ['pilot'] : [],
    topicSourceId: `ets-2023-test-01-topic-${topic}`,
    partOfSpeech,
    sense,
    payload: { word, definition: `(${partOfSpeech}) ${sense}`, example },
    source: [
      source(code, +page, {
        sourceTerm,
        exampleAuthorship: 'Original example composed for this project',
        definitionAuthorship: 'Original Vietnamese sense gloss',
      }),
    ],
    quality: {
      approved: Boolean(found),
      languageReviewed: true,
      sourceTermLocated: Boolean(found),
      review: 'Sense/POS/example edited; OCR context checked; no pronunciation/media claim',
    },
  };
});
if (words.length !== 100) throw Error('Expected exactly 100 edited entries');
const answerRows = [
  'DCBCD',
  'ABABC',
  'ABACA',
  'CBBCA',
  'CCBAB',
  'ACACB',
  'BADCC',
  'ABABD',
  'CBDCD',
  'BBADC',
  'DACCA',
  'ABACB',
  'AADBD',
  'CABDD',
  'CDBCD',
  'BCABD',
  'CADAA',
  'BDCAB',
  'DDCBA',
  'DCCBB',
  'CBABD',
  'DABCD',
  'CBDDA',
  'BBACD',
  'BCDBD',
  'ABBCB',
  'BCCAD',
  'ACDAA',
  'DDBDA',
  'CABBC',
  'CBDDC',
  'CDCBC',
  'AABDD',
  'CADAC',
  'CBCDA',
  'CABDC',
  'ABBDD',
  'CACBA',
  'BBDAD',
  'CADBC',
];
// Explicit transcription from the supplied answer image, not inferred from question semantics.
const keyString = answerRows.join('');
if (keyString.length !== 200) throw Error(`Answer image transcription length ${keyString.length}`);
const answerKey = Array.from(keyString, (correctOption, i) => ({
  questionNumber: i + 1,
  correctOption,
  source: {
    file: path.join(
      sourceRoot,
      files.find((f) => f.startsWith('1.5.')),
    ),
  },
  imageTranscriptionReviewed: true,
  independentCrossCheck: pilot.includes(i + 1),
}));
const ranges = [
  ...Array.from({ length: 13 }, (_, i) => [3, 32 + i * 3, 34 + i * 3]),
  ...Array.from({ length: 10 }, (_, i) => [4, 71 + i * 3, 73 + i * 3]),
  ...[131, 135, 139, 143].map((a) => [6, a, a + 3]),
  ...[
    [147, 148],
    [149, 150],
    [151, 153],
    [154, 155],
    [156, 157],
    [158, 161],
    [162, 165],
    [166, 168],
    [169, 171],
    [172, 175],
    [176, 180],
    [181, 185],
    [186, 190],
    [191, 195],
    [196, 200],
  ].map(([a, b]) => [7, a, b]),
];
const groups = ranges.map(([part, a, b], i) => ({
  sourceId: gid(a, b),
  kind: 'group',
  batches: [62, 95, 131, 186].includes(a) ? ['pilot'] : [],
  questionNumbers: Array.from({ length: b - a + 1 }, (_, i) => a + i),
  ...(part === 7 ? { documentCount: a < 176 ? 1 : a < 186 ? 2 : 3 } : {}),
  payload: {
    part,
    type: 'SINGLE_CHOICE',
    instruction: `Questions ${a}-${b}`,
    orderNo: i + 1,
    assets: [],
  },
  source: [],
  quality: {
    approved: false,
    notes: ['Passage/assets/transcript require source review before import'],
  },
}));
const questions = Array.from({ length: 200 }, (_, i) => {
  const n = i + 1,
    part = n <= 6 ? 1 : n <= 31 ? 2 : n <= 70 ? 3 : n <= 100 ? 4 : n <= 130 ? 5 : n <= 146 ? 6 : 7;
  const group = groups.find((g) => g.questionNumbers.includes(n));
  const sourcePages = require('./test1-source-pages.cjs')(n);
  return {
    sourceId: qid(n),
    kind: 'question',
    questionNumber: n,
    batches: pilot.includes(n) ? ['pilot'] : [],
    ...(group ? { groupSourceId: group.sourceId } : {}),
    payload: {
      part,
      type: 'SINGLE_CHOICE',
      difficulty: 'MEDIUM',
      correctOption: keyString[i],
      options: [],
      tags: [qid(n), 'ets-2023-test-01'],
      ...(group ? { positionInGroup: n - group.questionNumbers[0] + 1 } : {}),
    },
    source: [source(sourcePages.code, sourcePages.pages)],
    quality: {
      approved: false,
      textReviewed: false,
      answerCrossChecked: false,
      audioContentReviewed: false,
      notes: ['Raw OCR is a candidate only; missing text/options must not be invented'],
    },
  };
});
function setq(n, text, options, explanation, src) {
  const q = questions[n - 1];
  q.payload = {
    ...q.payload,
    questionText: text,
    options: options.map((optionText, i) => ({ optionCode: 'ABCD'[i], optionText })),
    explanation,
  };
  q.source = src;
  q.quality = {
    approved: q.payload.part >= 5,
    textReviewed: true,
    answerCrossChecked: true,
    audioContentReviewed: false,
    review:
      'Compared original page and answer image; listening content awaits playback verification',
  };
}
setq(
  1,
  null,
  ['A', 'B', 'C', 'D'],
  'D: The woman is looking at a map. Source image and transcript agree.',
  [source('11', 3), source('17', 1)],
);
questions[0].payload.transcript =
  '(A) A woman is standing near a desk.\n(B) A woman is climbing some stairs.\n(C) A woman is entering a building.\n(D) A woman is looking at a map.';
setq(7, null, ['A', 'B', 'C'], 'B identifies the type of food sold: cheese.', [
  source('11', 6),
  source('17', 2),
]);
questions[6].payload.transcript =
  'What type of food does that store sell?\n(A) What a delicious recipe.\n(B) They have all kinds of cheese.\n(C) With a new jacket.';
setq(
  62,
  "According to the man, why is today's Sea-Ride Special tour popular?",
  [
    'It offers a chance to see migrating birds.',
    'Water conditions are likely to be favorable.',
    'A guest chef is preparing lunch.',
    'Someone special will be guiding the tour.',
  ],
  'A: The penguins are migrating through the area.',
  [source('11', 9), source('17', 15)],
);
setq(
  63,
  'Look at the graphic. What time will the woman depart on a tour?',
  ['At 9 A.M.', 'At 10 A.M.', 'At 11 A.M.', 'At 12 P.M.'],
  'D: Island Exploration departs at 12 P.M.',
  [source('11', 9), source('17', 15)],
);
setq(
  64,
  'What will the woman most likely do next?',
  ['Return to her hotel', 'Visit a café', 'Call a friend', 'Store her bags in a locker'],
  'B: She mentions getting food at the coffee shop down the street.',
  [source('11', 9), source('17', 15)],
);
setq(
  95,
  'What is the main purpose of the call?',
  [
    'To place an order',
    'To dispute a charge',
    'To arrange a meeting',
    "To check a store's inventory",
  ],
  'A: The caller has decided which refrigerator to buy.',
  [source('11', 13), source('17', [25, 26])],
);
setq(
  96,
  'Look at the graphic. Which model does the speaker prefer?',
  ['SG-200', 'SG-250', 'XG-300', 'XG-350'],
  'D: XG-350 is extra large and has a stainless-steel finish.',
  [source('11', 13), source('17', [25, 26])],
);
setq(
  97,
  'What does the speaker ask about?',
  ['A warranty', 'A return process', 'A delivery fee', 'Product availability'],
  'C: He asks about an additional charge for delivery outside downtown.',
  [source('11', 13), source('17', [25, 26])],
);
setq(
  101,
  'When she held her last meeting, Ms. Toba ------- her sales staff to perform even better next quarter.',
  ['encourage', 'is encouraging', 'encouraged', 'was encouraged'],
  'C: The past meeting calls for an active past-simple verb. Ms. Toba encouraged her staff.',
  [source('12', 2), source('18', 1)],
);
setq(
  102,
  'All staff have been informed ------- the proposed partnership with ERI Finance.',
  ['for', 'about', 'to', 'at'],
  'B: inform somebody about something; passive: be informed about something.',
  [source('12', 2), source('18', 1)],
);
setq(
  103,
  'On Friday, Mr. Nakamura will discuss ------- ideas for supporting busy waiters.',
  ['his', 'him', 'himself', 'he'],
  'A: The noun ideas needs the possessive determiner his.',
  [source('12', 2), source('18', 1)],
);
setq(
  131,
  'Choose the best answer for blank 131.',
  ['locate', 'located', 'locates', 'location'],
  'B: located at introduces a reduced passive phrase describing the barbershop.',
  [source('12', 5), source('18', [9, 10])],
);
setq(
  132,
  'Choose the best answer for blank 132.',
  [
    'The results will be announced later this month.',
    'We are proud to serve our community with excellence.',
    'Pat and Kenny’s shop excelled in all four categories.',
    'Please call in advance to schedule an appointment.',
  ],
  'C: all four categories refers back to the four selection criteria and explains the award.',
  [source('12', 5), source('18', [9, 10])],
);
setq(
  133,
  'Choose the best answer for blank 133.',
  ['I', 'We', 'They', 'He'],
  'C: They refers to the two founders and is the subject of opened.',
  [source('12', 5), source('18', [9, 10])],
);
setq(
  134,
  'Choose the best answer for blank 134.',
  ['While', 'Despite', 'Even', 'Yet'],
  'A: While introduces a full contrast clause; Despite would require a noun phrase or gerund.',
  [source('12', 5), source('18', [9, 10])],
);
setq(
  186,
  'According to the schedule, who is Ms. Jones?',
  [
    'The advertising manager at a radio station',
    'The host of a community news program',
    'The music director at Wonder Ridge Radio',
    'The host of a sports radio program',
  ],
  "C: Josie's Joint is selected by the station's music director, Josie Jones.",
  [source('12', [26, 27]), source('19', [31, 33])],
);
setq(
  187,
  'What is the purpose of the e-mail?',
  [
    'To express praise for the radio station',
    'To ask about job opportunities',
    'To request more sports talk show programming',
    'To inquire about the name of a song',
  ],
  'A: The writer thanks the station for the experience and its programs.',
  [source('12', [26, 27]), source('19', 34)],
);
setq(
  188,
  'When did Mr. Fabre most likely first listen to Wonder Ridge Radio?',
  [
    'Between 6 A.M. and noon',
    'Between noon and 4 P.M.',
    'Between 4 P.M. and 7 P.M.',
    'Between 7 P.M. and 10 P.M.',
  ],
  'C: Folk music from around the world is broadcast on Folk Frenzy from 4 to 7 P.M.',
  [source('12', [26, 27]), source('19', 34)],
);
setq(
  189,
  'What does the job advertisement suggest applicants must have?',
  [
    'A willingness to travel',
    'Familiarity with computers',
    'A degree in communications',
    'Extensive experience in the radio industry',
  ],
  'B: The duties include updating a website and using scheduling software.',
  [source('12', [26, 27]), source('19', 34)],
);
setq(
  190,
  'What radio program will probably receive the most support from the programming assistant?',
  ['Coffee Break', 'Afternoon Jazz', 'Folk Frenzy', 'Josie’s Joint'],
  'A: Research on interviewees and suggested guests supports the news-and-interviews show Coffee Break.',
  [source('12', [26, 27]), source('19', 34)],
);
const g3 = groups.find((g) => g.sourceId === gid(62, 64));
g3.payload.transcript =
  "Man: Welcome to The Boat Center. How may I help you?\nWoman: Hi. Do you have any tickets for the Sea-Ride Special tour today? I was hoping to catch a last-minute tour.\nMan: Sorry. We're sold out. It's a really popular tour this time of year because the penguins are migrating through the area.\nWoman: Oh, too bad. I'm leaving tomorrow morning, and I was really hoping to take one of your tours.\nMan: Well, the Island Exploration tour still has a couple of spots left.\nWoman: Great. And that'll give me time to get something to eat before it starts. I see there's a coffee shop just down the street.";
g3.source = [source('11', 9), source('17', 15)];
const g4 = groups.find((g) => g.sourceId === gid(95, 97));
g4.payload.transcript =
  "Hi. This is Vinod Singh. I was in your store on Monday looking at refrigerators for my apartment. One of your employees showed me what you have in stock. I've decided to go with the extra-large refrigerator—the one with the stainless-steel finish, because it'll match the other appliances in my apartment. Oh, also, is there an additional charge for delivering outside of the downtown area? Please call me at 555-0130 so we can finalize the details.";
g4.source = [source('11', 13), source('17', [25, 26])];
const g6 = groups.find((g) => g.sourceId === gid(131, 134));
g6.payload.passageText =
  '# Local Barbershop Wins State Competition\n\nBy Miranda Warren\n\nMALENDA COUNTY (January 12)—Pat and Kenny’s Barbershop, [[1]] at 3949 Grand Street, has been named the best barbershop in the state by the Barber and Hairdresser’s Coalition. The criteria for selection include reputation, affordability, professionalism, and accreditations. [[2]].\n\nFounders and owners Kenneth Webber and Patrick Miller have been best friends since childhood. [[3]] opened the shop 34 years ago. [[4]] the shop retains its old-fashioned charm, the barbers have mastered the latest styles, not just the more traditional ones. People of all ages seeking a haircut or a new style should try Pat and Kenny’s Barbershop.';
g6.source = [source('12', 5)];
g6.quality = { approved: true, textReviewed: true };
const g7 = groups.find((g) => g.sourceId === gid(186, 190));
g7.payload.assets = [
  {
    kind: 'TEXT',
    orderNo: 1,
    content:
      "## Wonder Ridge Radio Broadcast Schedule, Monday–Friday\n\n| Time | Program | Content | Host |\n| --- | --- | --- | --- |\n| 6 A.M.–Noon | COFFEE BREAK | Local news and interviews with community members | Felice Finney |\n| Noon–4 P.M. | AFTERNOON JAZZ | Music from traditional jazz to jazz fusion | Malachi Mzee |\n| 4 P.M.–7 P.M. | FOLK FRENZY | Folk music from around the world | Penny Ariza |\n| 7 P.M.–10 P.M. | JOSIE'S JOINT | Modern sounds selected by our station's own music director | Josie Jones |",
  },
  {
    kind: 'TEXT',
    orderNo: 2,
    content:
      "**E-mail**\n\nTo: feedback@wonderridgeradio.org\n\nFrom: pfabre@sendmail.net\n\nSubject: My new radio station!\n\nDate: October 22\n\nTo the folks at Wonder Ridge Radio:\n\nAs I was driving last week, I got tired of listening to sports talk and turned the dial. Suddenly, my car was filled with a song that I hadn't heard in many years. It was traditional music from France, where my grandmother was born. She used to play that song when I was a child. I never expected to hear it on the radio here in Wonder Ridge. Thanks for this experience and for all your great programs.\n\nYour new fan,\n\nPierre Fabre",
  },
  {
    kind: 'TEXT',
    orderNo: 3,
    content:
      "## Wonder Ridge Radio Job Opening: Programming Assistant\n\nPosted November 2\n\n### Job Description\n\nThe programming assistant reports to the director of programming and supports the radio station by performing a variety of research and communication functions. This role is an entry-level, part-time position.\n\n### Responsibilities\n\n- Conducting background research on interviewees\n- Keeping up-to-date on news and news makers in order to suggest potential topics and guests for on-air interviews\n- Updating the station's Web site and program host biography pages\n- Using scheduling software to update the broadcast schedule\n- Communicating with listeners, especially via e-mail and social media\n\nTo apply, e-mail a résumé and cover letter to hiring@wonderridgeradio.org.",
  },
];
g7.source = [source('12', [26, 27])];
g7.quality = { approved: true, textReviewed: true, tableOrderReviewed: true };
for (const g of groups.filter((g) => !g.source.length))
  g.source = questions.filter((q) => q.groupSourceId === g.sourceId).flatMap((q) => q.source);
const lessons = require('./test1-lessons.cjs').map((l, i) => ({
  sourceId: `ets-2023-test-01-lesson-${i + 1}`,
  kind: 'lesson',
  batches: i === 0 ? ['pilot'] : [],
  payload: {
    lessonTitle: `TEST 1 - ${l.title}`,
    category: 'TOEIC Grammar',
    contentMarkdown: l.markdown,
    status: 'DRAFT',
  },
  source: [
    source('12', l.pages, {
      questionNumbers: l.questions,
      authorship: 'Original teaching text and practice; source identifies the grammar topic',
    }),
  ],
  quality: {
    approved: true,
    languageReviewed: true,
    exerciseKeyReviewed: true,
    publication: 'DRAFT until real API/UI acceptance',
  },
}));
const dataset = {
  schemaVersion: 1,
  datasetId: 'ets-2023-test-01',
  version: '1.0.0',
  usage: {
    source: 'User-supplied TEST 1 ETS 2023 / Zenlish material',
    scope: 'Local project preparation and acceptance requested by user',
    publicDistribution: 'NOT_CLEARED; no license evidence supplied',
    publicationGate: 'Content, media and real API/UI acceptance required',
  },
  topics,
  words,
  lessons,
  questions,
  groups,
  tests: [],
};
saveAtomic(path.join(root, 'dataset.json'), dataset);
saveAtomic(path.join(root, 'answer-key.json'), answerKey);
saveAtomic(path.join(root, 'review-queue.json'), {
  schemaVersion: 1,
  sourceOcr: 'ocr-pages.json.gz',
  audioClipsContentReviewed: 0,
  questions: questions
    .filter((q) => !q.quality.approved)
    .map((q) => ({
      sourceId: q.sourceId,
      source: q.source,
      reason: q.quality.textReviewed
        ? 'Audio playback/content confirmation pending'
        : 'OCR text/options/blanks/answer cross-check pending',
    })),
  groups: groups
    .filter((g) => !g.quality.approved)
    .map((g) => ({ sourceId: g.sourceId, source: g.source, reason: g.quality.notes })),
  words: words
    .filter((w) => !w.quality.approved)
    .map((w) => ({
      sourceId: w.sourceId,
      source: w.source,
      reason: 'Source term not located in OCR; inspect original page',
    })),
  blockers: [
    'Verify current Gateway services, runtime database/buckets and CONTENT_ADMIN login before applying',
    'Full audio has no test-level field/player in current Test DTO/renderer',
    'Pilot API/UI and all 54 listening clip content checks remain outstanding',
    'Single/double Part 7 layout probes still need API/UI acceptance',
  ],
});
console.log(
  JSON.stringify(
    {
      questions: questions.length,
      reviewedText: questions.filter((q) => q.quality.textReviewed).length,
      approvedQuestions: questions.filter((q) => q.quality.approved).length,
      groups: groups.length,
      words: words.length,
      approvedWords: words.filter((w) => w.quality.approved).length,
      lessons: lessons.length,
      unlocatedWords: words.filter((w) => !w.quality.approved).map((w) => w.payload.word),
    },
    null,
    2,
  ),
);
