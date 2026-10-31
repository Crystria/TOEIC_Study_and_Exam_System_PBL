import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestionBankClient } from '../../grpc/question-bank.client';
import { ScoringService, partStats } from '../../scoring/scoring.service';
import { TestsService } from '../tests/tests.service';
import { assertBundle, bundleErrors, fullStructureErrors } from '../tests/test-rules';
import { AnswerDto, HistoryQueryDto, PartAttemptDto, SubmitDto } from './dto/attempt.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { DraftStore } from './draft.store';
import { attemptInclude, AttemptRecord, attemptView, SnapshotOption } from './attempt-view';

@Injectable()
export class AttemptsService {
  private readonly logger = new Logger(AttemptsService.name);
  private readonly publicBase: string;
  private readonly minDuration: number;
  private readonly maxDuration: number;
  constructor(
    private readonly prisma: PrismaService,
    private readonly bank: QuestionBankClient,
    private readonly tests: TestsService,
    private readonly drafts: DraftStore,
    private readonly scoring: ScoringService,
    config: ConfigService,
  ) {
    this.publicBase =
      config.get<string>('MEDIA_PUBLIC_BASE_URL') ?? 'http://localhost:19000/toeic-media';
    this.minDuration = Number(config.get('PART_TEST_MIN_SECONDS') ?? 300);
    this.maxDuration = Number(config.get('PART_TEST_MAX_SECONDS') ?? 10800);
    if (
      !Number.isInteger(this.minDuration) ||
      !Number.isInteger(this.maxDuration) ||
      this.minDuration < 300 ||
      this.maxDuration > 10800 ||
      this.minDuration > this.maxDuration
    )
      throw new Error('Invalid Part Test duration configuration');
  }
  private async record(
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<AttemptRecord> {
    const a = await tx.attempt.findUnique({ where: { id }, include: attemptInclude });
    if (!a) throw new NotFoundException('Attempt not found');
    return a;
  }
  private owner(a: AttemptRecord, userId: string) {
    if (a.userId !== userId) throw new ForbiddenException('Attempt does not belong to user');
  }
  private editable(a: AttemptRecord) {
    if (a.snapshotVersion === 0) throw new ConflictException('Legacy attempts are read-only');
  }
  private async lock(tx: Prisma.TransactionClient, id: string) {
    const rows = await tx.$queryRaw<
      { attempt_id: string }[]
    >`SELECT attempt_id FROM attempts WHERE attempt_id = ${id} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException('Attempt not found');
  }
  async start(testId: string, userId: string, key?: string) {
    return this.startAttempt(testId, userId, 'FULL', [1, 2, 3, 4, 5, 6, 7], 7200, key);
  }
  async startPart(testId: string, userId: string, dto: PartAttemptDto, key?: string) {
    if (
      !dto.parts?.length ||
      dto.parts.some((p) => !Number.isInteger(p) || p < 1 || p > 7) ||
      new Set(dto.parts).size !== dto.parts.length
    )
      throw new BadRequestException('parts must be unique values in 1-7');
    if (
      !Number.isInteger(dto.durationSeconds) ||
      dto.durationSeconds < this.minDuration ||
      dto.durationSeconds > this.maxDuration
    )
      throw new BadRequestException(
        `durationSeconds must be ${this.minDuration}-${this.maxDuration}`,
      );
    return this.startAttempt(
      testId,
      userId,
      'PART',
      [...dto.parts].sort((a, b) => a - b),
      dto.durationSeconds,
      key,
    );
  }
  private async startAttempt(
    testId: string,
    userId: string,
    mode: 'FULL' | 'PART',
    parts: number[],
    durationSeconds: number,
    key?: string,
  ) {
    if (key && (key.length > 200 || !key.trim()))
      throw new BadRequestException('Invalid Idempotency-Key');
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ testId, mode, parts, durationSeconds }))
      .digest('hex');
    const result = await this.prisma.$transaction(
      async (tx) => {
        if (key) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`exam-key:${userId}:${key}`}, 0))`;
          const existing = await tx.attemptStartRequest.findUnique({
            where: { userId_key: { userId, key } },
          });
          if (existing) {
            if (existing.fingerprint !== fingerprint)
              throw new ConflictException('Idempotency-Key already used for another start request');
            await this.lock(tx, existing.attemptId);
            const a = await this.record(existing.attemptId, tx);
            return a.status === 'IN_PROGRESS' && a.deadlineAt.getTime() <= Date.now()
              ? this.finalize(tx, a, [], true)
              : a;
          }
        }
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`exam-start:${userId}:${testId}:${mode}`}, 0))`;
        await tx.$queryRaw`SELECT test_id FROM tests WHERE test_id = ${testId} FOR SHARE`;
        const test = await this.tests.record(testId, tx);
        if (mode === 'FULL') {
          const existing = await tx.attempt.findFirst({
            where: { testId, userId, mode, status: 'IN_PROGRESS', snapshotVersion: 1 },
            orderBy: { startedAt: 'desc' },
          });
          if (existing) {
            await this.lock(tx, existing.id);
            const a = await this.record(existing.id, tx);
            if (a.status === 'IN_PROGRESS' && a.deadlineAt.getTime() > Date.now()) {
              if (key)
                await tx.attemptStartRequest.create({
                  data: { userId, key, fingerprint, attemptId: a.id },
                });
              return a;
            }
            if (a.status === 'IN_PROGRESS') await this.finalize(tx, a, [], true);
          }
        }
        const items = test.questions.filter((q) => parts.includes(q.part));
        const structural =
          mode === 'FULL'
            ? fullStructureErrors(items, test.durationSeconds)
            : parts
                .filter((p) => !items.some((q) => q.part === p))
                .map((p) => `Part ${p} has no questions`);
        if (structural.length)
          throw new ConflictException({
            message: 'Test structure is not available',
            details: structural,
          });
        const ids = items.map((q) => q.questionId);
        const [bundle, keys] = await Promise.all([
          this.bank.getQuestionBundle(ids),
          this.bank.getAnswerBundle(ids),
        ]);
        assertBundle(items, bundle, keys);
        const byId = new Map(bundle.questions.map((q) => [q.id, q]));
        const answers = new Map(keys.answers.map((a) => [a.question_id, a.correct_option]));
        const usedGroups = bundle.groups.filter((g) =>
          items.some((item) => byId.get(item.questionId)?.group_id === g.group_id),
        );
        usedGroups.sort(
          (a, b) =>
            Math.min(
              ...items
                .filter((i) => byId.get(i.questionId)?.group_id === a.group_id)
                .map((i) => i.orderNo),
            ) -
            Math.min(
              ...items
                .filter((i) => byId.get(i.questionId)?.group_id === b.group_id)
                .map((i) => i.orderNo),
            ),
        );
        const groupIds = new Map(usedGroups.map((g) => [g.group_id, randomUUID()]));
        const startedAt = new Date(),
          attemptId = randomUUID();
        await tx.attempt.create({
          data: {
            id: attemptId,
            testId,
            userId,
            mode,
            durationSeconds,
            deadlineAt: new Date(startedAt.getTime() + durationSeconds * 1000),
            startedAt,
            snapshotVersion: 1,
            totalQuestions: items.length,
            parts: {
              create: parts.map((part, index) => ({
                part,
                orderNo: index + 1,
                totalQuestions: items.filter((q) => q.part === part).length,
              })),
            },
          },
        });
        if (usedGroups.length)
          await tx.attemptGroupSnapshot.createMany({
            data: usedGroups.map((g, index) => ({
              id: groupIds.get(g.group_id)!,
              attemptId,
              groupId: g.group_id,
              part: g.part,
              orderNo: index + 1,
              type: g.type,
              instruction: g.instruction || null,
              audioKey: g.audio_key || null,
              transcript: g.transcript || null,
              passageText: g.passage_text || null,
              assets: (g.assets ?? []).map((asset) => ({
                assetId: asset.asset_id,
                kind: asset.kind,
                storageKey: asset.storage_key || null,
                content: asset.content || null,
                orderNo: asset.order_no,
              })),
            })),
          });
        await tx.attemptQuestionSnapshot.createMany({
          data: items.map((item) => {
            const q = byId.get(item.questionId)!;
            return {
              attemptId,
              questionId: q.id,
              part: q.part,
              orderNo: item.orderNo,
              type: q.type,
              questionText: q.question_text || q.stem || '',
              groupSnapshotId: groupIds.get(q.group_id) ?? null,
              positionInGroup: q.position_in_group || null,
              transcript: q.transcript || null,
              audioKey: q.audio_key || null,
              imageKey: q.image_key || null,
              explanation: q.explanation || null,
              correctOption: answers.get(q.id)!,
              options: q.options.map((o) => ({ optionCode: o.option_key, optionText: o.content })),
            };
          }),
        });
        if (key)
          await tx.attemptStartRequest.create({ data: { userId, key, fingerprint, attemptId } });
        return this.record(attemptId, tx);
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
    return attemptView(result, this.publicBase);
  }
  async parts(testId: string) {
    const test = await this.tests.record(testId);
    const bundle = await this.bank.getQuestionBundle(test.questions.map((q) => q.questionId));
    return {
      testId,
      parts: [1, 2, 3, 4, 5, 6, 7].map((part) => {
        const items = test.questions.filter((q) => q.part === part);
        const active = bundle.questions.filter((q) => items.some((i) => i.questionId === q.id));
        const relevant = {
          ...bundle,
          missing_ids: items
            .filter((i) => !active.some((q) => q.id === i.questionId))
            .map((i) => i.questionId),
        };
        const errors = items.length ? bundleErrors(items, relevant) : ['Part has no questions'];
        return {
          part,
          totalQuestions: active.length,
          groupCount: new Set(active.map((q) => q.group_id).filter(Boolean)).size,
          available: errors.length === 0,
          errors,
        };
      }),
    };
  }
  private validateChoices(a: AttemptRecord, answers: AnswerDto[]) {
    const seen = new Set<string>();
    for (const answer of answers) {
      if (seen.has(answer.questionId))
        throw new BadRequestException('Duplicate question in answers');
      seen.add(answer.questionId);
      const q = a.questionSnapshots.find((q) => q.questionId === answer.questionId);
      if (!q) throw new BadRequestException('Question does not belong to attempt snapshot');
      if (
        answer.selectedOption !== null &&
        !(q.options as unknown as SnapshotOption[]).some(
          (o) => o.optionCode === answer.selectedOption,
        )
      )
        throw new BadRequestException('Invalid selected option for question');
    }
  }
  async saveDraft(attemptId: string, userId: string, answers: AnswerDto[]) {
    const saved = await this.prisma.$transaction(
      async (tx) => {
        await this.lock(tx, attemptId);
        const a = await this.record(attemptId, tx);
        this.owner(a, userId);
        this.editable(a);
        if (a.status !== 'IN_PROGRESS') throw new ConflictException('Attempt is already complete');
        if (a.deadlineAt.getTime() <= Date.now())
          return { expired: true, attempt: await this.finalize(tx, a, [], true), answeredAt: '' };
        this.validateChoices(a, answers);
        const answeredAt = await this.drafts.write(attemptId, a.deadlineAt, answers);
        return { expired: false, attempt: a, answeredAt };
      },
      { timeout: 10_000 },
    );
    if (saved.expired)
      throw new ConflictException({
        message: 'Attempt deadline has passed',
        details: { attemptId, status: saved.attempt.status },
      });
    return { attemptId, saved: answers.length, answeredAt: saved.answeredAt };
  }
  async saveAnswer(attemptId: string, questionId: string, dto: SaveAnswerDto, userId: string) {
    const saved = await this.saveDraft(attemptId, userId, [
      { questionId, selectedOption: dto.selectedOption },
    ]);
    return {
      attemptId,
      questionId,
      selectedOption: dto.selectedOption,
      answeredAt: saved.answeredAt,
    };
  }
  private async finalize(
    tx: Prisma.TransactionClient,
    a: AttemptRecord,
    submitted: AnswerDto[],
    forceExpired = false,
  ): Promise<AttemptRecord> {
    if (a.status !== 'IN_PROGRESS') return a;
    this.editable(a);
    let expired = forceExpired || a.deadlineAt.getTime() <= Date.now();
    const draft = await this.drafts.read(a.id);
    expired ||= a.deadlineAt.getTime() <= Date.now();
    const choices = new Map<string, string | null>(
      Object.entries(draft).map(([id, answer]) => [id, answer.selectedOption]),
    );
    if (!expired) {
      this.validateChoices(a, submitted);
      for (const answer of submitted) choices.set(answer.questionId, answer.selectedOption);
    }
    const stats = partStats(a.questionSnapshots, choices),
      completedAt = expired ? a.deadlineAt : new Date();
    const correctCount = stats.reduce((n, p) => n + p.correctCount, 0),
      totalQuestions = a.questionSnapshots.length;
    if (!totalQuestions) throw new ConflictException('Attempt has no snapshots');
    const full = a.mode === 'FULL' ? this.scoring.full(stats) : null;
    await tx.attemptAnswer.createMany({
      data: a.questionSnapshots.map((q) => ({
        attemptId: a.id,
        attemptQuestionSnapshotId: q.id,
        questionId: q.questionId,
        selectedOption: choices.get(q.questionId) ?? null,
        isCorrect: choices.get(q.questionId) === q.correctOption,
        answeredAt:
          draft[q.questionId]?.answeredAt &&
          !submitted.some((s) => !expired && s.questionId === q.questionId)
            ? new Date(draft[q.questionId].answeredAt)
            : completedAt,
      })),
    });
    for (const stat of stats)
      await tx.attemptPart.update({
        where: { attemptId_part: { attemptId: a.id, part: stat.part } },
        data: {
          correctCount: stat.correctCount,
          totalQuestions: stat.totalQuestions,
          accuracy: stat.accuracy,
        },
      });
    await tx.attempt.update({
      where: { id: a.id },
      data: {
        status: expired ? 'EXPIRED' : 'SUBMITTED',
        completedAt,
        submittedAt: expired ? null : completedAt,
        correctCount,
        totalQuestions,
        accuracy: correctCount / totalQuestions,
        score: full?.totalScore ?? null,
        scoreListening: full?.scoreListening ?? null,
        scoreReading: full?.scoreReading ?? null,
      },
    });
    const eventId = randomUUID(),
      occurredAt = new Date(),
      eventType = a.mode === 'FULL' ? 'TestSubmittedEvent' : 'PartPracticeSubmittedEvent';
    const common = {
      eventId,
      occurredAt: occurredAt.getTime(),
      attemptId: a.id,
      userId: a.userId,
      testId: a.testId,
      mode: a.mode,
      completedAt: completedAt.getTime(),
    };
    const payload = full
      ? {
          ...common,
          ...full,
          score: full.totalScore,
          totalCorrect: correctCount,
          partDetails: stats,
        }
      : {
          ...common,
          parts: stats.map((p) => p.part),
          totalQuestions,
          correctCount,
          accuracy: correctCount / totalQuestions,
          partStats: stats,
          durationSeconds: a.durationSeconds,
        };
    await tx.outboxEvent.create({
      data: {
        id: eventId,
        aggregateType: 'Attempt',
        aggregateId: a.id,
        eventType,
        occurredAt,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
    return this.record(a.id, tx);
  }
  async submit(attemptId: string, userId: string, dto: SubmitDto = {}) {
    const a = await this.prisma.$transaction(
      async (tx) => {
        await this.lock(tx, attemptId);
        const a = await this.record(attemptId, tx);
        this.owner(a, userId);
        if (a.status !== 'IN_PROGRESS') return a;
        return this.finalize(tx, a, dto.answers ?? []);
      },
      { timeout: 20_000 },
    );
    return attemptView(a, this.publicBase);
  }
  async getResult(attemptId: string, userId: string) {
    const a = await this.record(attemptId);
    this.owner(a, userId);
    if (a.snapshotVersion > 0 && a.status === 'IN_PROGRESS' && a.deadlineAt.getTime() <= Date.now())
      return this.submit(attemptId, userId);
    const draft =
      a.snapshotVersion > 0 && a.status === 'IN_PROGRESS' ? await this.drafts.read(a.id) : {};
    return attemptView(a, this.publicBase, draft);
  }
  async history(userId: string, query: HistoryQueryDto) {
    const where: Prisma.AttemptWhereInput = { userId, testId: query.testId, mode: query.mode };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.attempt.findMany({
        where,
        include: { test: { select: { title: true } }, parts: { orderBy: { orderNo: 'asc' } } },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.size,
        take: query.size,
      }),
      this.prisma.attempt.count({ where }),
    ]);
    return {
      items: items.map((a) => ({
        attemptId: a.id,
        testId: a.testId,
        testTitle: a.test.title,
        mode: a.mode,
        status: a.status,
        parts: a.parts.map((p) => p.part),
        durationSeconds: a.durationSeconds,
        startedAt: a.startedAt,
        deadlineAt: a.deadlineAt,
        completedAt: a.completedAt,
        score: a.mode === 'FULL' ? a.score : null,
        scoreListening: a.mode === 'FULL' ? a.scoreListening : null,
        scoreReading: a.mode === 'FULL' ? a.scoreReading : null,
        accuracy: a.accuracy,
        correctCount: a.correctCount,
        totalQuestions: a.totalQuestions,
        readOnly: a.snapshotVersion === 0,
      })),
      total,
      page: query.page,
      size: query.size,
      totalPages: Math.ceil(total / query.size),
    };
  }
  async expireDue(graceSeconds = 5): Promise<number> {
    const due = await this.prisma.attempt.findMany({
      where: {
        status: 'IN_PROGRESS',
        snapshotVersion: 1,
        deadlineAt: { lte: new Date(Date.now() - graceSeconds * 1000) },
      },
      take: 50,
      orderBy: { deadlineAt: 'asc' },
      select: { id: true },
    });
    let expired = 0;
    for (const { id } of due) {
      try {
        const done = await this.prisma.$transaction(
          async (tx) => {
            const rows = await tx.$queryRaw<
              { attempt_id: string }[]
            >`SELECT attempt_id FROM attempts WHERE attempt_id = ${id} FOR UPDATE SKIP LOCKED`;
            if (!rows.length) return false;
            const a = await this.record(id, tx);
            if (a.status !== 'IN_PROGRESS' || a.deadlineAt.getTime() > Date.now()) return false;
            await this.finalize(tx, a, [], true);
            return true;
          },
          { timeout: 20_000 },
        );
        if (done) expired++;
      } catch (error) {
        this.logger.warn(`Expiry deferred for ${id}: ${(error as Error).message}`);
      }
    }
    return expired;
  }
}
