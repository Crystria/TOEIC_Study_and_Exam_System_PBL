import { PrismaService } from './prisma/prisma.service';
import { GroupsService } from './modules/groups/groups.service';
import { MediaService } from './modules/media/media.service';
import { GroupRecord, QuestionRecord } from './modules/questions/question-rules';
import { QuestionsService } from './modules/questions/questions.service';
import { SearchService } from './modules/search/search.service';

const uuid = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const now = new Date('2026-11-18T00:00:00Z');
const media = { url: (key: string | null) => (key ? `https://media.example.test/${key}` : null) };

function question(id: string): QuestionRecord {
  return {
    id,
    part: 1,
    type: 'SINGLE_CHOICE',
    questionText: `Question ${id}`,
    explanation: `Explanation ${id}`,
    correctOption: 'C',
    difficulty: 'MEDIUM',
    transcript: `Transcript ${id}`,
    audioKey: `questions/${id}/audio.mp3`,
    imageKey: `questions/${id}/image.png`,
    groupId: null,
    positionInGroup: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    group: null,
    tags: [{ questionId: id, tagId: 'tag-1', tag: { id: 'tag-1', name: 'office' } }],
    options: ['A', 'B', 'C', 'D'].map((optionCode) => ({
      questionId: id,
      optionCode,
      optionText: `Option ${optionCode}`,
    })),
  } as unknown as QuestionRecord;
}

function group(id: string, withArchivedMember = false): GroupRecord {
  const member = (memberId: string, position: number, archived = false) => ({
    ...question(memberId),
    groupId: id,
    part: 7,
    positionInGroup: position,
    deletedAt: archived ? now : null,
  });
  return {
    id,
    part: 7,
    type: 'PASSAGE',
    instruction: `Instruction ${id}`,
    passageText: `Passage ${id}`,
    audioKey: `groups/${id}/audio.mp3`,
    transcript: `Shared transcript ${id}`,
    orderNo: 5,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    assets: [
      { id: 'text', kind: 'TEXT', content: 'Supplemental passage', storageKey: null, orderNo: 1 },
      { id: 'image', kind: 'IMAGE', content: null, storageKey: 'groups/image.png', orderNo: 2 },
      { id: 'audio', kind: 'AUDIO', content: null, storageKey: 'groups/audio.mp3', orderNo: 3 },
    ],
    questions: [
      member('member-2', 2),
      ...(withArchivedMember ? [member('archived-member', 3, true)] : []),
      member('member-1', 1),
    ],
  } as unknown as GroupRecord;
}

describe('Question batch detail serialization', () => {
  it('preserves request order, returns full admin fields and reports absent/archived refs', async () => {
    const requested = [uuid(2), uuid(3), uuid(1), uuid(4), uuid(5)];
    const findMany = jest.fn().mockResolvedValue([question(uuid(1)), question(uuid(2))]);
    const service = new QuestionsService(
      { question: { findMany } } as unknown as PrismaService,
      {} as SearchService,
      media as unknown as MediaService,
    );

    const result = await service.details(requested);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: requested },
          deletedAt: null,
          OR: [{ groupId: null }, { group: { deletedAt: null } }],
        },
        include: expect.objectContaining({
          options: { orderBy: { optionCode: 'asc' } },
          tags: { include: { tag: true } },
        }),
      }),
    );
    expect(result.items.map((item) => item.questionId)).toEqual([uuid(2), uuid(1)]);
    // IDs omitted by the active-record query include missing questions,
    // archived questions and questions belonging to archived groups.
    expect(result.missingIds).toEqual([uuid(3), uuid(4), uuid(5)]);
    expect(result.items[0]).toMatchObject({
      questionId: uuid(2),
      questionText: `Question ${uuid(2)}`,
      correctOption: 'C',
      explanation: `Explanation ${uuid(2)}`,
      transcript: `Transcript ${uuid(2)}`,
      audioUrl: `https://media.example.test/questions/${uuid(2)}/audio.mp3`,
      imageUrl: `https://media.example.test/questions/${uuid(2)}/image.png`,
      tags: ['office'],
      isComplete: true,
      createdAt: now,
      updatedAt: now,
    });
    expect(result.items[0].options.map((option) => option.optionCode)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
    expect(result.items[0].options[2].optionText).toBe('Option C');
  });

  it('returns every unavailable ID rather than fabricating question contents', async () => {
    const service = new QuestionsService(
      { question: { findMany: jest.fn().mockResolvedValue([]) } } as unknown as PrismaService,
      {} as SearchService,
      media as unknown as MediaService,
    );
    await expect(service.details([uuid(1), uuid(2)])).resolves.toEqual({
      items: [],
      missingIds: [uuid(1), uuid(2)],
    });
  });
});

describe('Group batch detail serialization', () => {
  it('preserves requested order, shared media/assets and active-member order', async () => {
    const requested = [uuid(2), uuid(3), uuid(1), uuid(4)];
    const findMany = jest.fn().mockResolvedValue([group(uuid(1)), group(uuid(2), true)]);
    const service = new GroupsService(
      { questionGroup: { findMany } } as unknown as PrismaService,
      {} as QuestionsService,
      media as unknown as MediaService,
    );

    const result = await service.details(requested);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: requested }, deletedAt: null },
        include: expect.objectContaining({ assets: { orderBy: { orderNo: 'asc' } } }),
      }),
    );
    expect(result.items.map((item) => item.groupId)).toEqual([uuid(2), uuid(1)]);
    expect(result.missingIds).toEqual([uuid(3), uuid(4)]);
    expect(result.items[0]).toMatchObject({
      groupId: uuid(2),
      instruction: `Instruction ${uuid(2)}`,
      passageText: `Passage ${uuid(2)}`,
      transcript: `Shared transcript ${uuid(2)}`,
      audioUrl: `https://media.example.test/groups/${uuid(2)}/audio.mp3`,
      questionIds: ['member-1', 'member-2'],
      isComplete: false,
    });
    expect(result.items[0].assets).toEqual([
      {
        assetId: 'text',
        kind: 'TEXT',
        content: 'Supplemental passage',
        storageKey: null,
        orderNo: 1,
        publicUrl: null,
      },
      {
        assetId: 'image',
        kind: 'IMAGE',
        content: null,
        storageKey: 'groups/image.png',
        orderNo: 2,
        publicUrl: 'https://media.example.test/groups/image.png',
      },
      {
        assetId: 'audio',
        kind: 'AUDIO',
        content: null,
        storageKey: 'groups/audio.mp3',
        orderNo: 3,
        publicUrl: 'https://media.example.test/groups/audio.mp3',
      },
    ]);
    expect(result.items[1].isComplete).toBe(true);
  });

  it('reports missing and archived groups without exposing archived shared contents', async () => {
    const service = new GroupsService(
      { questionGroup: { findMany: jest.fn().mockResolvedValue([]) } } as unknown as PrismaService,
      {} as QuestionsService,
      media as unknown as MediaService,
    );
    await expect(service.details([uuid(1), uuid(2)])).resolves.toEqual({
      items: [],
      missingIds: [uuid(1), uuid(2)],
    });
  });
});
