import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAudioTimeline,
  buildListeningAudioTracks,
  resolveAudioPosition,
  type ListeningAudioQuestion,
} from '../src/lib/exams/listening-audio';

test('All 100 listening questions play in order, with each group recording only once', () => {
  const questions: ListeningAudioQuestion[] = [];
  const groups: { id: string; audioUrl: string }[] = [];
  for (let number = 1; number <= 200; number++) {
    const part = number <= 6 ? 1 : number <= 31 ? 2 : number <= 70 ? 3 : number <= 100 ? 4 : 5;
    const groupFirst =
      part === 3
        ? 32 + Math.floor((number - 32) / 3) * 3
        : part === 4
          ? 71 + Math.floor((number - 71) / 3) * 3
          : number;
    const groupId = `group-${groupFirst}`;
    if (!groups.some((group) => group.id === groupId))
      groups.push({ id: groupId, audioUrl: `/audio/${groupFirst}.mp3` });
    questions.push({ id: `q${number}`, part, orderNo: number, groupId });
  }
  const tracks = buildListeningAudioTracks([...questions].reverse(), groups);
  assert.equal(tracks.length, 54);
  assert.deepEqual(
    tracks.flatMap((track) => track.questionIds),
    Array.from({ length: 100 }, (_, index) => `q${index + 1}`),
  );
  assert.deepEqual(tracks[31], {
    id: 'audio-q32',
    source: '/audio/32.mp3',
    label: 'Audio câu 32–34',
    questionIds: ['q32', 'q33', 'q34'],
  });
  assert.equal(tracks.at(-1)?.label, 'Audio câu 98–100');
  assert.equal(questions[0].orderNo, 1);
});

test('Question audio overrides group audio, and AUDIO assets supply missing group audio', () => {
  const tracks = buildListeningAudioTracks(
    [
      { id: 'q1', part: 1, orderNo: 1, groupId: 'g1', audioUrl: '/question.mp3' },
      { id: 'q2', part: 2, orderNo: 2, groupId: 'g1' },
      { id: 'q3', part: 3, orderNo: 3, groupId: 'g2' },
      { id: 'q4', part: 4, orderNo: 4, groupId: 'missing' },
      { id: 'q5', part: 5, orderNo: 5, audioUrl: '/reading.mp3' },
    ],
    [
      { id: 'g1', audioUrl: '/group.mp3' },
      {
        id: 'g2',
        assets: [
          { kind: 'IMAGE', url: '/image.png' },
          { kind: 'AUDIO', url: null },
          { kind: 'AUDIO', url: '/asset.mp3' },
        ],
      },
    ],
  );
  assert.deepEqual(
    tracks.map((track) => track.source),
    ['/question.mp3', '/group.mp3', '/asset.mp3'],
  );
  assert.deepEqual(buildListeningAudioTracks([], []), []);
});

test('A full recording reused across questions/groups is not repeated', () => {
  const tracks = buildListeningAudioTracks(
    [
      { id: 'q31', part: 2, orderNo: 31, groupId: 'a' },
      { id: 'q32', part: 3, orderNo: 32, groupId: 'b' },
    ],
    [
      { id: 'a', audioUrl: '/full.mp3' },
      { id: 'b', audioUrl: '/full.mp3' },
    ],
  );
  assert.equal(tracks.length, 1);
  assert.deepEqual(tracks[0].questionIds, ['q31', 'q32']);
});

test('Combined duration and seeks cross clip boundaries without losing fractional time', () => {
  const timeline = buildAudioTimeline([10.25, 20.5, 5]);
  assert.deepEqual(timeline, {
    offsets: [0, 10.25, 30.75],
    durations: [10.25, 20.5, 5],
    totalDuration: 35.75,
    complete: true,
  });
  assert.deepEqual(resolveAudioPosition(timeline, 0), { trackIndex: 0, position: 0 });
  assert.deepEqual(resolveAudioPosition(timeline, 10.25), { trackIndex: 1, position: 0 });
  assert.deepEqual(resolveAudioPosition(timeline, 30.5), { trackIndex: 1, position: 20.25 });
  assert.deepEqual(resolveAudioPosition(timeline, 30.75), { trackIndex: 2, position: 0 });
  assert.deepEqual(resolveAudioPosition(timeline, 999), { trackIndex: 2, position: 5 });
  assert.deepEqual(resolveAudioPosition(timeline, -10), { trackIndex: 0, position: 0 });
});

test('Unknown or invalid durations cannot expose a misleading combined seek position', () => {
  for (const durations of [[], [0], [10, NaN], [10, Infinity], [10, -1]]) {
    const timeline = buildAudioTimeline(durations);
    assert.equal(timeline.complete, false);
    assert.equal(resolveAudioPosition(timeline, 12), null);
    assert.equal(Number.isFinite(timeline.totalDuration), true);
  }
  assert.deepEqual(resolveAudioPosition(buildAudioTimeline([10]), NaN), {
    trackIndex: 0,
    position: 0,
  });
});
