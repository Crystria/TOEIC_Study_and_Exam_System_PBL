// Run npm run test -w @toeic/web first to compile current typed fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const content = require('./content.json');
const crypto = require('node:crypto');
const manifest = require('./recordings-20261027/manifest.json');
const { createLearningCatalog } = require(
  path.join(root, 'apps/web/.test-build/src/lib/learning/mock-data.js'),
);
const { demoExamTests } = require(
  path.join(root, 'apps/web/.test-build/src/lib/exams/mock-data.js'),
);
const { buildDemoQuestions } = require(
  path.join(root, 'apps/web/.test-build/src/lib/exams/question-fixtures.js'),
);
const words = createLearningCatalog().words;
assert.equal(words.length, 24);
for (const word of words) {
  const clips = content.clips.filter((clip) => clip.fixtureIds.includes(word.id));
  assert.equal(clips.length, 1);
  assert.equal(clips[0].segments[0].text, `${word.word}.`);
  assert.equal(clips[0].segments[1].text, word.example);
  assert.equal(clips[0].topicId, word.topicId);
  assert.equal(word.audioUrl, clips[0].publicUrl);
}
let groups = 0;
for (const exam of demoExamTests) {
  const set = buildDemoQuestions(exam, {
    mode: 'MOCK_TEST',
    scope: 'full',
    partIds: exam.parts.map((part) => part.id),
  });
  for (const group of set.groups.filter((group) => group.partId <= 4)) {
    const clips = content.clips.filter((clip) => clip.fixtureIds.includes(group.id));
    assert.equal(clips.length, 1);
    assert.equal(clips[0].part, group.partId);
    assert.equal(group.audioUrl, clips[0].publicUrl);
    groups++;
  }
  for (const group of set.groups.filter((group) => group.partId > 4)) {
    assert.equal(group.audioUrl, null);
  }
  assert.ok(set.questions.every((question) => question.options.length === 4));
  assert.doesNotMatch(
    JSON.stringify(set),
    /"(transcript|isCorrect|explanation|correctOption|answerKey)"/,
  );
}
for (const clip of content.clips) {
  assert.equal(new Set(clip.fixtureIds).size, clip.fixtureIds.length);
  const file = fs.readFileSync(path.join(root, 'apps/web/public', clip.publicUrl));
  const record = manifest.files.find((entry) => entry.id === clip.id);
  assert.ok(record);
  assert.equal(file.length, record.bytes);
  assert.equal(crypto.createHash('sha256').update(file).digest('hex'), record.sha256);
}
console.log(
  `PASS: 24 words and ${groups} Listening groups mapped to 28 MP3s; sizes/checksums verified; no transcript in question sets.`,
);
