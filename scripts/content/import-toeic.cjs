/* Gateway-only importer. No SQL, storage credentials, guard bypass or progress writes. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseArgs } = require('node:util');
const canonical = (v) =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
const hash = (v) =>
  crypto
    .createHash('sha256')
    .update(typeof v === 'string' || Buffer.isBuffer(v) ? v : canonical(v))
    .digest('hex');
const read = (file) => {
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch {
    throw Error(`Invalid JSON file: ${file}`);
  }
};
const norm = (s) => String(s).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const routes = {
  topic: '/learning/admin/vocabulary-topics',
  word: '/learning/admin/vocabularies',
  lesson: '/learning/admin/lessons',
  question: '/questions',
  group: '/question-groups',
  test: '/tests',
};
const idFields = {
  topic: 'topicId',
  word: 'vocabularyId',
  lesson: 'lessonId',
  question: 'questionId',
  group: 'groupId',
  test: 'testId',
};
const targetIdentity = (t) => ({
  gateway: t.gateway,
  storagePublicOrigin: t.storagePublicOrigin,
  questionBucket: t.questionBucket,
  learningBucket: t.learningBucket,
  databases: Object.fromEntries(
    Object.entries(t.databases || {}).map(([k, v]) => [
      k,
      typeof v === 'object' ? { host: v.host, port: v.port, name: v.name } : v,
    ]),
  ),
});
let activeReport, activeReportPath;

function expansionAcceptance(state, scope, apiOnly = false, loadEvidence = read) {
  const a = state?.acceptance;
  if (!apiOnly) {
    if (!a?.[scope === 'learning' ? 'learningPilot' : 'pilot'])
      throw Error('Pilot acceptance has not passed; full expansion is blocked');
    return 'pilot';
  }
  if (scope !== 'exam') throw Error('API-only expansion supports Exam scope only');
  if (
    !a?.examPilotApi ||
    !a.examPilotReimportApi ||
    !a.examPilotApiEvidence ||
    !a.examPilotReimportApiEvidence
  )
    throw Error('API-only expansion requires verified pilot API and reimport evidence');
  const api = loadEvidence(a.examPilotApiEvidence);
  const reimport = loadEvidence(a.examPilotReimportApiEvidence);
  if (
    api.outcome !== 'complete' ||
    api.result?.questions !== 20 ||
    api.result?.groups !== 4 ||
    !api.result?.allComplete ||
    !api.result?.publicMediaHashMatches ||
    !reimport.allBusinessModelsUnchangedOnReimport
  )
    throw Error('Pilot API/readback/preservation evidence does not support expansion');
  return 'exam-api-only';
}

function validateDataset(d, batch = 'pilot', scope = 'all') {
  const errors = [],
    selected = [];
  if (d.schemaVersion !== 1 || !d.datasetId || !d.version)
    errors.push('Invalid dataset identity/version');
  const ids = new Set();
  const all = [
    ...(d.topics || []),
    ...(d.words || []),
    ...(d.lessons || []),
    ...(d.questions || []),
    ...(d.groups || []),
    ...(d.tests || []),
  ];
  for (const r of all) {
    if (!r.sourceId || ids.has(r.sourceId))
      errors.push(`Duplicate/missing sourceId: ${r.sourceId}`);
    ids.add(r.sourceId);
    if (
      (batch !== 'all' && !r.batches?.includes(batch)) ||
      (scope !== 'all' &&
        (scope === 'learning'
          ? !['topic', 'word', 'lesson'].includes(r.kind)
          : !['question', 'group', 'test'].includes(r.kind)))
    )
      continue;
    selected.push(r);
    if (!r.source?.length) errors.push(`${r.sourceId}: missing provenance`);
    if (!r.quality?.approved) errors.push(`${r.sourceId}: editorial review pending`);
    if (r.kind === 'question') {
      const p = r.payload || {},
        codes = (p.options || []).map((o) => o.optionCode);
      const expected = p.part === 2 ? 'ABC' : 'ABCD';
      if (
        codes.join('') !== expected ||
        !codes.includes(p.correctOption) ||
        p.options.some((o) => !o.optionText?.trim())
      )
        errors.push(`${r.sourceId}: invalid choices/key`);
      if (
        [3, 4, 6, 7].includes(p.part) &&
        (!r.groupSourceId || !Number.isInteger(p.positionInGroup) || p.positionInGroup < 1)
      )
        errors.push(`${r.sourceId}: invalid group/position`);
      if ([1, 2, 3, 4].includes(p.part) && !r.quality.audioContentReviewed)
        errors.push(`${r.sourceId}: listening content not verified`);
      if (
        [1, 2].includes(p.part) &&
        (!p.transcript?.trim() || !(r.media || []).some((m) => m.field === 'audioKey'))
      )
        errors.push(`${r.sourceId}: spoken transcript/audio mapping required`);
      if (p.part === 1 && !(r.media || []).some((m) => m.field === 'imageKey'))
        errors.push(`${r.sourceId}: original exam image required`);
      if (p.part >= 3 && !p.questionText?.trim())
        errors.push(`${r.sourceId}: missing question text`);
      if (!r.quality.answerCrossChecked) errors.push(`${r.sourceId}: answer not cross-checked`);
      if (
        r.groupSourceId &&
        !ids.has(r.groupSourceId) &&
        !d.groups?.some((g) => g.sourceId === r.groupSourceId)
      )
        errors.push(`${r.sourceId}: missing group`);
    }
    if (
      r.kind === 'word' &&
      (!r.partOfSpeech || !r.sense || !r.payload?.example || !r.payload?.definition)
    )
      errors.push(`${r.sourceId}: incomplete vocabulary`);
    if (
      r.kind === 'lesson' &&
      !['Mục tiêu', 'Lý thuyết', 'Ví dụ', 'Lỗi thường gặp', 'Luyện tập', 'Đáp án', 'Nguồn'].every(
        (s) => r.payload?.contentMarkdown?.includes(s),
      )
    )
      errors.push(`${r.sourceId}: incomplete lesson`);
    if (r.kind === 'group') {
      const members = d.questions.filter((q) => q.groupSourceId === r.sourceId);
      if (!members.length || members.length !== r.questionNumbers?.length)
        errors.push(`${r.sourceId}: missing members`);
      if (
        !members.every((q) => q.payload.part === r.payload.part) ||
        canonical(members.map((q) => q.payload.positionInGroup).sort((a, b) => a - b)) !==
          canonical(members.map((_, i) => i + 1))
      )
        errors.push(`${r.sourceId}: member Part/position mismatch`);
      if (!members.every((q) => q.batches?.includes(batch) || batch === 'all'))
        errors.push(`${r.sourceId}: batch splits a group`);
      if (r.payload?.part === 6) {
        const positions = [...(r.payload.passageText || '').matchAll(/\[\[(\d+)\]\]/g)]
          .map((m) => +m[1])
          .sort();
        if (
          canonical(positions) !== canonical(members.map((q) => q.payload.positionInGroup).sort())
        )
          errors.push(`${r.sourceId}: Part 6 placeholders mismatch`);
      }
      if (
        r.payload?.part === 7 &&
        r.documentCount !==
          (r.payload.assets || []).filter((a) => a.kind === 'TEXT' || a.kind === 'IMAGE').length
      )
        errors.push(`${r.sourceId}: document order/count mismatch`);
      const orders = (r.payload.assets || []).map((a) => a.orderNo);
      if (
        new Set(orders).size !== orders.length ||
        orders.some((n) => !Number.isInteger(n) || n < 1)
      )
        errors.push(`${r.sourceId}: invalid asset order`);
    }
    for (const m of r.media || []) {
      if (!m.contentReviewed) errors.push(`${r.sourceId}/${m.sourceId}: media review pending`);
      if (!fs.existsSync(m.file) || hash(fs.readFileSync(m.file)) !== m.sha256)
        errors.push(`${r.sourceId}/${m.sourceId}: media hash/file mismatch`);
    }
  }
  const q = selected.filter((r) => r.kind === 'question');
  if (scope !== 'learning' && batch === 'pilot') {
    const expected = [
      1, 7, 62, 63, 64, 95, 96, 97, 101, 102, 103, 131, 132, 133, 134, 186, 187, 188, 189, 190,
    ];
    if (canonical(q.map((r) => r.questionNumber).sort((a, b) => a - b)) !== canonical(expected))
      errors.push('Pilot must contain exactly the specified 20 source questions');
  }
  if (scope !== 'learning' && batch === 'all') {
    if (
      d.questions.length !== 200 ||
      new Set(d.questions.map((q) => q.questionNumber)).size !== 200 ||
      !Array.from({ length: 200 }, (_, i) => i + 1).every((n) =>
        d.questions.some((q) => q.questionNumber === n),
      )
    )
      errors.push('Full dataset requires source numbers 1..200');
    const groups = d.groups || [];
    if (groups.length !== 42) errors.push('Full dataset requires 42 groups');
    if (
      [1, 2, 3].some(
        (n, i) =>
          groups.filter((g) => g.payload?.part === 7 && g.documentCount === n).length !==
          [10, 2, 3][i],
      )
    )
      errors.push('Part 7 must have 10 single, 2 double, 3 triple groups');
  }
  for (const r of selected.filter((r) => r.kind === 'test'))
    if (
      q.length !== 200 ||
      r.questionSourceIds?.length !== 200 ||
      new Set(r.questionSourceIds).size !== 200 ||
      r.payload.durationSeconds !== 7200 ||
      !r.questionSourceIds.every(
        (id, i) => d.questions.find((q) => q.sourceId === id)?.questionNumber === i + 1,
      )
    )
      errors.push(
        `${r.sourceId}: Full Test requires 200 reviewed questions in source order and 7200 seconds`,
      );
  const meanings = new Set();
  for (const r of selected.filter((r) => r.kind === 'word')) {
    const k = canonical([norm(r.payload.word), r.partOfSpeech, norm(r.sense)]);
    if (meanings.has(k)) errors.push(`${r.sourceId}: duplicate word/POS/sense`);
    meanings.add(k);
  }
  return { valid: errors.length === 0, errors, records: selected };
}

function saveAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temp, file);
}
function equivalent(row, payload) {
  return Object.entries(payload).every(([k, v]) => {
    if (k === 'options')
      return (
        canonical(
          (row[k] || [])
            .map(({ optionCode, optionText }) => ({ optionCode, optionText }))
            .sort((a, b) => a.optionCode.localeCompare(b.optionCode)),
        ) === canonical([...v].sort((a, b) => a.optionCode.localeCompare(b.optionCode)))
      );
    if (k === 'tags') return canonical([...(row.tags || [])].sort()) === canonical([...v].sort());
    if (k === 'assets')
      return (
        canonical(
          (row.assets || [])
            .map((a) => ({
              kind: a.kind,
              orderNo: a.orderNo,
              ...(a.kind === 'TEXT' ? { content: a.content } : { storageKey: a.storageKey }),
            }))
            .sort((a, b) => a.orderNo - b.orderNo),
        ) === canonical([...v].sort((a, b) => a.orderNo - b.orderNo))
      );
    if (k === 'questions') return true; // Nested members are checked individually by ID below.
    return canonical(row[k] ?? null) === canonical(v ?? null);
  });
}

class Importer {
  constructor(options) {
    Object.assign(this, options);
    this.fetch = options.fetch || fetch;
    this.state = options.state || {
      schemaVersion: 1,
      datasetId: options.dataset.datasetId,
      target: options.target,
      records: {},
      media: {},
    };
    if (
      this.state.datasetId !== options.dataset.datasetId ||
      canonical(targetIdentity(this.state.target)) !== canonical(targetIdentity(options.target))
    )
      throw Error('Checkpoint belongs to another dataset/target');
    this.events = [];
  }
  persist() {
    if (this.stateFile) saveAtomic(this.stateFile, this.state);
  }
  log(event) {
    this.events.push({ at: new Date().toISOString(), ...event });
    if (this.logFile) fs.appendFileSync(this.logFile, JSON.stringify(this.events.at(-1)) + '\n');
  }
  async request(method, resource, body, key) {
    // Refresh this importer's own session before expiry, including after quota waits.
    if (this.token && this.refreshToken && !resource.startsWith('/auth/')) {
      let expiresAt;
      try {
        expiresAt = JSON.parse(Buffer.from(this.token.split('.')[1], 'base64url').toString()).exp;
      } catch {
        /* Non-JWT test tokens have no expiry. */
      }
      if (Number.isFinite(expiresAt) && expiresAt * 1000 <= Date.now() + 60000) {
        const refreshed = await this.request('POST', '/auth/refresh', {
          refreshToken: this.refreshToken,
        });
        if (!refreshed.accessToken || !refreshed.refreshToken)
          throw Error('Importer refresh response is incomplete; stop before replaying a write');
        this.token = refreshed.accessToken;
        this.refreshToken = refreshed.refreshToken;
        this.log({ action: 'auth-refreshed' });
      }
    }
    if (this.intervalMs) await new Promise((resolve) => setTimeout(resolve, this.intervalMs));
    const u = new URL(this.target.gateway + resource);
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    };
    let r;
    try {
      r = await this.fetch(u, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(this.timeoutMs || 15000),
      });
    } catch {
      const e = Error(
        `Transport failed: ${method} ${resource.split('?')[0]}; reconcile checkpoint before retry`,
      );
      e.ambiguous = method !== 'GET';
      throw e;
    }
    let data;
    try {
      data = await r.json();
    } catch {
      const e = Error(`Invalid response: ${method} ${resource.split('?')[0]}`);
      e.ambiguous = method !== 'GET';
      throw e;
    }
    if (!r.ok) {
      // Gateway rejects these before proxying. Honor its quota with the same actor/key.
      // Unknown outcomes, 5xx, and business errors are never automatically retried.
      if (this.waitOnRateLimit && r.status === 429 && data.code === 'RATE_LIMITED') {
        const seconds = Number(r.headers.get('retry-after'));
        if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3600)
          throw Error('Invalid Gateway Retry-After; checkpoint retained');
        this.rateLimitWaitMs = (this.rateLimitWaitMs || 0) + seconds * 1000;
        if (this.rateLimitWaitMs > (this.maxRateLimitWaitMs || 3 * 3600000))
          throw Error('Quota wait budget exhausted; resume from checkpoint later');
        for (let remaining = seconds * 1000; remaining > 0; remaining -= 60000) {
          this.log({
            action: 'rate-limit-wait',
            resource: resource.split('?')[0],
            remainingSeconds: Math.ceil(remaining / 1000),
          });
          await (this.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(
            Math.min(remaining, 60000),
          );
        }
        return this.request(method, resource, body, key);
      }
      const e = Error(
        `HTTP ${r.status}: ${method} ${resource.split('?')[0]} (${data.code || 'API_ERROR'})`,
      );
      e.status = r.status;
      e.ambiguous = method !== 'GET' && r.status >= 500;
      throw e;
    }
    return data;
  }
  async login(credentials) {
    const j = await this.request('POST', '/auth/login', {
      email: credentials.email,
      password: credentials.password,
      deviceId: 'toeic-content-importer-v1',
    });
    this.token = j.accessToken;
    this.refreshToken = j.refreshToken;
    if (!this.token || !j.user?.roles?.includes('CONTENT_ADMIN'))
      throw Error('A real CONTENT_ADMIN account is required');
    this.actorId = j.user.userId;
    if (this.state.actorId && this.state.actorId !== this.actorId)
      throw Error('Checkpoint actor differs; durable Learning keys are actor-scoped');
    this.state.actorId = this.actorId;
  }
  async logout() {
    if (!this.token || !this.refreshToken) return false;
    try {
      await this.request('POST', '/auth/logout', { refreshToken: this.refreshToken });
      return true;
    } finally {
      this.token = undefined;
      this.refreshToken = undefined;
    }
  }
  async all(route) {
    let rows = [];
    for (let page = 1; page <= 10000; page++) {
      const j = await this.request(
        'GET',
        `${route}${route.includes('?') ? '&' : '?'}page=${page}&size=50`,
      );
      if (!Array.isArray(j.items)) throw Error('Unexpected catalog response');
      rows.push(...j.items);
      if (page >= (j.totalPages || 1)) return rows;
    }
    throw Error('Pagination did not terminate');
  }
  payload(r) {
    const p = structuredClone(r.payload);
    for (const m of r.media || []) {
      const stored = this.state.media[m.sourceId];
      if (stored?.status === 'verified') {
        if (m.field === 'asset')
          p.assets = [
            ...(p.assets || []),
            { kind: m.mediaType, storageKey: stored.storageKey, orderNo: m.orderNo },
          ].sort((a, b) => a.orderNo - b.orderNo);
        else p[m.field] = stored.storageKey;
      }
    }
    if (r.kind === 'word') {
      const parent = this.state.records[r.topicSourceId];
      if (!parent?.id) throw Error(`${r.sourceId}: topic not imported`);
      p.topicId = parent.id;
    }
    if (r.kind === 'question' && r.groupSourceId) {
      const parent = this.state.records[r.groupSourceId];
      if (!parent?.id) throw Error(`${r.sourceId}: group not imported`);
      p.groupId = parent.id;
    }
    if (r.kind === 'group')
      p.questions = this.dataset.questions
        .filter((q) => q.groupSourceId === r.sourceId)
        .sort((a, b) => a.payload.positionInGroup - b.payload.positionInGroup)
        .map((q) => structuredClone(q.payload));
    if (r.kind === 'test')
      p.questions = r.questionSourceIds.map((id, i) => {
        const q = this.dataset.questions.find((x) => x.sourceId === id),
          map = this.state.records[id];
        if (!map?.id) throw Error(`${id}: missing question ID`);
        return { questionId: map.id, orderNo: i + 1, part: q.payload.part };
      });
    return p;
  }
  async discover(r) {
    if (r.kind === 'group') {
      const first = this.dataset.questions
        .filter((q) => q.groupSourceId === r.sourceId)
        .sort((a, b) => a.payload.positionInGroup - b.payload.positionInGroup)[0];
      if (!first) throw Error(`${r.sourceId}: group has no source member`);
      const member = await this.discover(first);
      return member?.groupId ? this.request('GET', `${routes.group}/${member.groupId}`) : undefined;
    }
    const marker = r.sourceId;
    let url = routes[r.kind];
    if (r.kind === 'question') url += `?tag=${encodeURIComponent(marker)}`;
    if (r.kind === 'group') url += `?keyword=${encodeURIComponent(marker)}`;
    if (r.kind === 'topic') url += `?keyword=${encodeURIComponent(r.payload.topicName)}`;
    if (r.kind === 'word') url += `?keyword=${encodeURIComponent(r.payload.word)}`;
    if (r.kind === 'lesson') url += `?keyword=${encodeURIComponent(r.payload.lessonTitle)}`;
    const rows = await this.all(url);
    const matches = rows.filter((x) => {
      if (x.deletedAt) return false;
      if (r.kind === 'question') return x.tags?.includes(marker);
      if (r.kind === 'group') return x.instruction?.includes(`[${marker}]`);
      if (r.kind === 'topic') return norm(x.topicName) === norm(r.payload.topicName);
      if (r.kind === 'word')
        return (
          norm(x.word) === norm(r.payload.word) &&
          norm(x.definition) === norm(r.payload.definition) &&
          x.topicId === this.state.records[r.topicSourceId]?.id
        );
      if (r.kind === 'lesson') return x.lessonTitle === r.payload.lessonTitle;
      return x.title === r.payload.title;
    });
    if (matches.length > 1)
      throw Error(`${marker}: multiple backend matches; manual reconciliation required`);
    return matches[0];
  }
  async readback(r, id, payload) {
    const row = await this.request('GET', `${routes[r.kind]}/${id}`);
    if (row[idFields[r.kind]] !== id || row.deletedAt || !equivalent(row, payload))
      throw Error(`${r.sourceId}: readback differs; checkpoint retained`);
    if (r.kind === 'group') {
      const members = this.dataset.questions
        .filter((q) => q.groupSourceId === r.sourceId)
        .sort((a, b) => a.payload.positionInGroup - b.payload.positionInGroup);
      if (row.questionIds?.length !== members.length)
        throw Error(`${r.sourceId}: member count mismatch`);
      for (let i = 0; i < members.length; i++) {
        const q = members[i],
          qid = row.questionIds[i];
        await this.readback(q, qid, { ...q.payload, groupId: id });
        this.state.records[q.sourceId] = {
          id: qid,
          kind: 'question',
          status: 'verified',
          fingerprint: hash(q.payload),
        };
      }
    }
    return row;
  }
  async record(r, apply) {
    const previous = this.state.records[r.sourceId];
    if (apply && previous?.id)
      for (const media of r.media || [])
        if (
          this.state.media[media.sourceId] &&
          this.state.media[media.sourceId].status !== 'verified'
        )
          await this.upload(r, media);
    const payload = this.payload(r),
      fingerprint = hash(payload);
    let row = previous?.id
      ? await this.request('GET', `${routes[r.kind]}/${previous.id}`)
      : await this.discover(r);
    if (previous?.id && row[idFields[r.kind]] !== previous.id)
      throw Error(`${r.sourceId}: resource identity changed during readback`);
    if (row?.deletedAt)
      throw Error(`${r.sourceId}: archived record must not be recreated automatically`);
    const id = row?.[idFields[r.kind]];
    if (previous?.status === 'pending' && !row)
      throw Error(`${r.sourceId}: ambiguous create unresolved; refusing another POST`);
    const action = !row ? 'add' : equivalent(row, payload) ? 'same' : 'update';
    this.log({ sourceId: r.sourceId, kind: r.kind, action, mode: apply ? 'apply' : 'plan' });
    if (!apply) {
      if (id) this.state.records[r.sourceId] = { ...(previous || {}), id, kind: r.kind };
      return action;
    }
    if (row && action === 'update' && !previous?.id)
      throw Error(`${r.sourceId}: existing unowned content differs; refusing overwrite`);
    if (action === 'update' && ['group', 'test'].includes(r.kind))
      throw Error(
        `${r.sourceId}: structural changes need explicit migration review; no automatic replace`,
      );
    this.state.records[r.sourceId] = {
      ...(previous || {}),
      ...(id ? { id } : {}),
      kind: r.kind,
      status: 'pending',
      fingerprint,
    };
    this.persist();
    if (action !== 'same') {
      const key = `${this.dataset.datasetId}:${r.sourceId}:create:v1`;
      try {
        row = await this.request(
          action === 'add' ? 'POST' : 'PATCH',
          routes[r.kind] + (id ? '/' + id : ''),
          payload,
          action === 'add' ? key : undefined,
        );
      } catch (e) {
        this.state.records[r.sourceId].status = e.ambiguous ? 'pending' : 'rejected';
        this.persist();
        throw e;
      }
    }
    const finalId = row[idFields[r.kind]];
    if (!finalId) throw Error(`${r.sourceId}: response missing resource ID`);
    this.state.records[r.sourceId].id = finalId;
    this.persist();
    await this.readback(r, finalId, payload);
    this.state.records[r.sourceId] = { id: finalId, kind: r.kind, status: 'verified', fingerprint };
    this.persist();
    for (const media of r.media || []) await this.upload(r, media);
    return action;
  }
  async upload(r, m) {
    const owner = this.state.records[r.sourceId],
      key = m.sourceId,
      old = this.state.media[key];
    if (!m.contentReviewed) throw Error(`${key}: media quality pending`);
    const bytes = fs.readFileSync(m.file);
    if (hash(bytes) !== m.sha256) throw Error(`${key}: local media changed`);
    if (old?.sha256 && old.sha256 !== m.sha256)
      throw Error(`${key}: uploaded media version differs; review replacement explicitly`);
    if (old?.storageKey) {
      const row = await this.request('GET', `${routes[r.kind]}/${owner.id}`);
      const attached =
        m.field === 'asset'
          ? row.assets?.some((a) => a.storageKey === old.storageKey)
          : row[m.field] === old.storageKey;
      if (attached) {
        this.state.media[key].status = 'verified';
        this.persist();
        return;
      }
      if (old.status === 'verified') throw Error(`${key}: confirmed media no longer attached`);
    }
    // Presign URLs remain in memory only; checkpoint stores stable object keys and upload IDs.
    const learning = r.kind === 'word',
      resource = learning
        ? `/learning/vocabularies/${owner.id}/media`
        : `${routes[r.kind]}/${owner.id}/media`;
    // Reconcile a completed PUT/attachment before requesting any new upload URL.
    if (old?.storageKey) {
      try {
        await this.attach(r, m, old.storageKey, old.uploadId, resource);
        this.state.media[key].status = 'verified';
        this.persist();
        return;
      } catch (e) {
        if (![400, 409].includes(e.status)) throw e;
        if (old.status === 'uploaded')
          throw Error(
            `${key}: uploaded object failed confirmation; manual reconciliation required`,
          );
      }
    }
    const ticket = await this.request(
      'POST',
      resource + '/presign',
      learning
        ? { kind: m.mediaType, contentType: m.contentType, sizeBytes: bytes.length }
        : { mediaType: m.mediaType, contentType: m.contentType, fileName: path.basename(m.file) },
      `${key}:${m.sha256}`,
    );
    if (ticket.expiresIn === 0 || (ticket.expiresAt && new Date(ticket.expiresAt) <= new Date()))
      throw Error(
        `${key}: expired upload ticket; reconcile stored object before obtaining another target`,
      );
    const storageKey = ticket.storageKey || ticket.objectKey;
    const uploadUrl = new URL(ticket.uploadUrl || ticket.putUrl);
    const expectedOrigin = new URL(this.target.storagePublicOrigin).origin;
    if (uploadUrl.origin !== expectedOrigin)
      throw Error(`${key}: signed URL is outside verified storage origin`);
    if (
      learning &&
      !uploadUrl.pathname.startsWith(
        '/' + encodeURIComponent(this.target.learningBucket) + '/learning/',
      )
    )
      throw Error(`${key}: Learning bucket/key prefix differs`);
    if (!learning && this.target.questionBucket && ticket.bucket !== this.target.questionBucket)
      throw Error(`${key}: Question Bank bucket differs`);
    this.state.media[key] = {
      ownerSourceId: r.sourceId,
      sha256: m.sha256,
      storageKey,
      uploadId: ticket.uploadId,
      status: 'presigned',
    };
    this.persist();
    let response;
    try {
      response = await this.fetch(uploadUrl, {
        method: 'PUT',
        headers: ticket.requiredHeaders || { 'Content-Type': m.contentType },
        body: bytes,
        signal: AbortSignal.timeout(120000),
      });
    } catch {
      throw Error(
        `${key}: storage PUT outcome unknown; resume with same object and verify attachment`,
      );
    }
    if (!response.ok) throw Error(`${key}: storage PUT returned ${response.status}`);
    this.state.media[key].status = 'uploaded';
    this.persist();
    await this.attach(r, m, storageKey, ticket.uploadId, resource);
    this.state.media[key].status = 'verified';
    this.persist();
  }
  async attach(r, m, storageKey, uploadId, resource) {
    const owner = this.state.records[r.sourceId],
      learning = r.kind === 'word';
    if (learning)
      await this.request(
        'POST',
        resource + '/confirm',
        { uploadId },
        `${m.sourceId}:confirm:${m.sha256}`,
      );
    else {
      let patch;
      if (m.field === 'asset') {
        const row = await this.request('GET', `${routes[r.kind]}/${owner.id}`);
        patch = {
          assets: [
            ...(row.assets || [])
              .filter((a) => a.orderNo !== m.orderNo)
              .map((a) => ({
                kind: a.kind,
                orderNo: a.orderNo,
                ...(a.kind === 'TEXT' ? { content: a.content } : { storageKey: a.storageKey }),
              })),
            { kind: m.mediaType, storageKey, orderNo: m.orderNo },
          ],
        };
      } else patch = { [m.field]: storageKey };
      await this.request('PATCH', `${routes[r.kind]}/${owner.id}`, patch);
    }
    const row = await this.request('GET', `${routes[r.kind]}/${owner.id}`);
    if (
      !(m.field === 'asset'
        ? row.assets?.some((a) => a.storageKey === storageKey)
        : row[m.field] === storageKey)
    )
      throw Error(`${m.sourceId}: attachment readback failed`);
  }
}

async function main() {
  const { values: o } = parseArgs({
    options: {
      dataset: { type: 'string', default: 'data/toeic/ets-2023-test-01/dataset.json' },
      batch: { type: 'string', default: 'pilot' },
      scope: { type: 'string', default: 'all' },
      mode: { type: 'string', default: 'validate' },
      target: { type: 'string' },
      credentials: { type: 'string' },
      state: { type: 'string' },
      out: { type: 'string' },
      'api-only': { type: 'boolean', default: false },
      'wait-rate-limits': { type: 'boolean', default: false },
    },
  });
  if (
    !['validate', 'plan', 'apply'].includes(o.mode) ||
    !['pilot', 'all'].includes(o.batch) ||
    !['all', 'learning', 'exam'].includes(o.scope)
  )
    throw Error('Invalid mode, batch or scope');
  const dataset = read(o.dataset),
    validation = validateDataset(dataset, o.batch, o.scope);
  const report = {
    datasetId: dataset.datasetId,
    version: dataset.version,
    mode: o.mode,
    batch: o.batch,
    scope: o.scope,
    valid: validation.valid,
    counts: Object.fromEntries(
      Object.keys(routes).map((k) => [k, validation.records.filter((r) => r.kind === k).length]),
    ),
    errors: validation.errors,
  };
  if (o.out) {
    fs.mkdirSync(o.out, { recursive: true });
    const f = path.join(o.out, 'report.json');
    if (fs.existsSync(f)) throw Error('Evidence report exists; choose a new --out');
    saveAtomic(f, report);
  }
  activeReport = report;
  activeReportPath = o.out ? path.join(o.out, 'report.json') : undefined;
  if (o.mode === 'validate') {
    report.outcome = validation.valid ? 'validated' : 'quality_blocked';
    if (activeReportPath) saveAtomic(activeReportPath, report);
    console.log(JSON.stringify(report, null, 2));
    if (!validation.valid) process.exitCode = 2;
    return;
  }
  if (!validation.valid)
    throw Error('Quality/structure validation failed; no API writes attempted');
  if (
    !o.target ||
    (!o.credentials && !(process.env.TOEIC_IMPORT_EMAIL && process.env.TOEIC_IMPORT_PASSWORD)) ||
    !o.state ||
    !o.out
  )
    throw Error(
      'Online modes require --target --state --out and --credentials or TOEIC_IMPORT_EMAIL/TOEIC_IMPORT_PASSWORD',
    );
  const target = read(o.target),
    u = new URL(target.gateway);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname) ||
    !['http:', 'https:'].includes(u.protocol) ||
    u.pathname !== '/api/v1' ||
    u.username ||
    u.password
  )
    throw Error('Only an explicitly verified local Gateway /api/v1 is supported');
  if (
    o.mode === 'apply' &&
    (!target.verifiedAt || !target.databases || !target.questionBucket || !target.learningBucket)
  )
    throw Error('Target manifest must record verified runtime databases and both storage buckets');
  if (
    o.mode === 'apply' &&
    !(o.scope === 'all' ? ['learning', 'exam'] : [o.scope]).every((s) =>
      (target.verifiedScopes || []).includes(s),
    )
  )
    throw Error('This target has not been verified for the selected service scope');
  const lock = o.state + '.lock';
  fs.mkdirSync(path.dirname(o.state), { recursive: true });
  let lockFd, importer;
  try {
    lockFd = fs.openSync(lock, 'wx');
    fs.writeSync(lockFd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    const state = fs.existsSync(o.state) ? read(o.state) : undefined;
    if (o.batch === 'all' && (o.mode === 'apply' || o['api-only']))
      report.acceptancePath = expansionAcceptance(state, o.scope, o['api-only']);
    importer = new Importer({
      dataset,
      target,
      state,
      stateFile: o.mode === 'apply' ? o.state : undefined,
      logFile: path.join(o.out, 'events.jsonl'),
      intervalMs: 250,
      waitOnRateLimit: o['wait-rate-limits'],
    });
    const credentials =
      process.env.TOEIC_IMPORT_EMAIL && process.env.TOEIC_IMPORT_PASSWORD
        ? { email: process.env.TOEIC_IMPORT_EMAIL, password: process.env.TOEIC_IMPORT_PASSWORD }
        : read(o.credentials);
    await importer.login(credentials.accounts?.content_admin || credentials);
    const ready = await fetch(new URL('/ready', target.gateway), {
      signal: AbortSignal.timeout(5000),
    });
    report.gatewayReadiness = { status: ready.status, body: await ready.json() };
    if (o.scope !== 'learning' && !ready.ok) throw Error('Question Bank/Exam stack is not ready');
    const records = validation.records.filter((r) => !(r.kind === 'question' && r.groupSourceId));
    const ordered = ['topic', 'word', 'lesson', 'question', 'group', 'test'].flatMap((k) =>
      records.filter((r) => r.kind === k),
    );
    const summary = { add: 0, update: 0, same: 0 };
    for (const r of ordered) {
      // Online planning cannot resolve new parent IDs without writing. Count children explicitly.
      if (o.mode === 'plan' && r.kind === 'word' && !importer.state.records[r.topicSourceId]?.id) {
        summary.add++;
        importer.log({ sourceId: r.sourceId, action: 'add', dependency: r.topicSourceId });
        continue;
      }
      summary[await importer.record(r, o.mode === 'apply')]++;
    }
    report.summary = summary;
    report.outcome = 'complete';
    report.completedAt = new Date().toISOString();
    saveAtomic(path.join(o.out, 'report.json'), report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (importer?.token && importer?.refreshToken) {
      try {
        report.authCleanup = { loggedOut: await importer.logout() };
      } catch (e) {
        report.authCleanup = { loggedOut: false, error: e.message };
        console.error('Importer authentication cleanup failed; see report.json');
        process.exitCode = 1;
      }
      saveAtomic(path.join(o.out, 'report.json'), report);
    }
    if (lockFd !== undefined) {
      fs.closeSync(lockFd);
      fs.unlinkSync(lock);
    }
  }
}
module.exports = {
  Importer,
  validateDataset,
  equivalent,
  canonical,
  hash,
  saveAtomic,
  targetIdentity,
  expansionAcceptance,
};
if (require.main === module)
  main().catch((e) => {
    if (activeReport && activeReportPath) {
      activeReport.outcome = 'blocked';
      activeReport.runtimeError = e.message;
      activeReport.failedAt = new Date().toISOString();
      saveAtomic(activeReportPath, activeReport);
    }
    console.error(e.message);
    process.exitCode = 1;
  });
