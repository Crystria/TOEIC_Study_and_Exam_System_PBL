import { randomUUID } from 'node:crypto';
import { require } from './config.mjs';
const bcrypt = require('bcrypt');
export const password = process.env.QA_ACCOUNT_PASSWORD ?? 'QA-Local-2026!';
export async function accounts(auth, namespace) {
  const roles = {};
  for (const code of ['USER', 'SYSTEM_ADMIN'])
    roles[code] = await auth.role.upsert({
      where: { code },
      create: { code, name: code },
      update: {},
    });
  const hash = await bcrypt.hash(password, 12),
    users = [];
  for (let index = 0; index < 5; index++) {
    const email = `qa-${namespace}-${index}@example.test`;
    const user = await auth.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: hash,
        fullName: `QA ${index}`,
        roles: {
          create: [
            { roleId: roles.USER.id },
            ...(index < 3 ? [{ roleId: roles.SYSTEM_ADMIN.id }] : []),
          ],
        },
      },
      update: {},
    });
    users.push({ id: user.id, email });
  }
  return users;
}
// Synthetic transport fixtures; they contain no copyrighted exam content.
export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZtQAAAAASUVORK5CYII=',
  'base64',
);
export const audio = Buffer.concat(
  Array.from({ length: 4 }, () => {
    const frame = Buffer.alloc(417);
    frame.set([0xff, 0xfb, 0x90, 0x00]);
    return frame;
  }),
);
export async function seed(api, admins, label, track) {
  const items = [],
    groups = [],
    counts = [6, 25, 39, 30, 30, 16, 54];
  let actorIndex = 0,
    presigns = 0;
  const actor = () => admins[actorIndex++ % admins.length];
  const question = (part, number) => ({
    part,
    type: 'SINGLE_CHOICE',
    questionText: `${label} Part ${part} question ${number}`,
    difficulty: 'EASY',
    correctOption: 'A',
    explanation: 'QA explanation: answer A.',
    transcript: part <= 2 ? 'QA transcript' : undefined,
    tags: [label],
    options: (part === 2 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']).map((optionCode) => ({
      optionCode,
      optionText: `QA option ${optionCode}`,
    })),
  });
  async function upload(scope, id, mediaType) {
    const auth = admins[presigns++ % admins.length],
      isAudio = mediaType === 'AUDIO';
    const signed = await api(
      'POST',
      `/api/v1/${scope}/${id}/media/presign`,
      auth,
      {
        mediaType,
        contentType: isAudio ? 'audio/mpeg' : 'image/png',
        fileName: isAudio ? 'qa.mp3' : 'qa.png',
      },
      201,
    );
    track.objects.add(signed.storageKey);
    const response = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': signed.contentType },
      body: isAudio ? audio : png,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`MinIO upload failed: ${response.status}`);
    await response.body?.cancel();
    return signed.storageKey;
  }
  for (let part = 1; part <= 7; part++) {
    const grouped = [3, 4, 6, 7].includes(part),
      groupSize = part === 6 ? 4 : 3;
    for (let index = 0; index < counts[part - 1]; index += grouped ? groupSize : 1) {
      if (grouped) {
        const children = Array.from({ length: groupSize }, (_, i) => ({
          ...question(part, index + i + 1),
          positionInGroup: i + 1,
        }));
        const group = await api(
          'POST',
          '/api/v1/question-groups',
          actor(),
          {
            part,
            type: 'QA_STIMULUS',
            transcript: part <= 4 ? 'QA group transcript' : undefined,
            passageText:
              part === 6
                ? 'QA passage [[1]] [[2]] [[3]] [[4]]'
                : part === 7
                  ? `${label} reading passage`
                  : undefined,
            questions: children,
          },
          201,
        );
        track.groups.add(group.groupId);
        group.questionIds.forEach((id) => track.questions.add(id));
        groups.push(group);
        if (part <= 4)
          await api(
            'PATCH',
            `/api/v1/question-groups/${group.groupId}`,
            actor(),
            { audioKey: await upload('question-groups', group.groupId, 'AUDIO') },
            200,
          );
        for (const id of group.questionIds)
          items.push({ questionId: id, part, orderNo: items.length + 1 });
      } else {
        const q = await api('POST', '/api/v1/questions', actor(), question(part, index + 1), 201);
        track.questions.add(q.questionId);
        if (part <= 2) {
          const audioKey = await upload('questions', q.questionId, 'AUDIO');
          const imageKey =
            part === 1 ? await upload('questions', q.questionId, 'IMAGE') : undefined;
          await api(
            'PATCH',
            `/api/v1/questions/${q.questionId}`,
            actor(),
            { audioKey, imageKey },
            200,
          );
        }
        items.push({ questionId: q.questionId, part, orderNo: items.length + 1 });
      }
    }
  }
  const test = await api(
    'POST',
    '/api/v1/tests',
    actor(),
    { title: label, durationSeconds: 7200, questions: items },
    201,
  );
  track.tests.add(test.testId);
  return { testId: test.testId, items, groups, presigns };
}
export function tracking() {
  return { questions: new Set(), groups: new Set(), tests: new Set(), objects: new Set() };
}
export function runId() {
  return randomUUID().replaceAll('-', '').slice(0, 12);
}
