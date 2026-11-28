import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from './search.service';

describe('versioned search indexing', () => {
  function setup(deletedAt: Date | null = null) {
    const q = {
      id: 'q1',
      part: 7,
      type: 'PASSAGE',
      questionText: 'Question text',
      transcript: null,
      explanation: 'Explanation',
      correctOption: 'SECRET_ANSWER',
      difficulty: 'EASY',
      tags: [{ tag: { name: 'tag' } }],
      groupId: 'g1',
      updatedAt: new Date(1000),
      deletedAt,
      group: {
        updatedAt: new Date(2000),
        passageText: 'Full passage',
        transcript: 'Group transcript',
        assets: [{ content: 'Second passage' }],
      },
    };
    const prisma = { question: { findUnique: jest.fn().mockResolvedValue(q) } };
    const search = new SearchService(
      { get: () => undefined } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
    const index = jest.spyOn(search['client'], 'index').mockResolvedValue({} as never);
    return { search, index };
  }
  it('indexes complete text without the answer key, using the group update version', async () => {
    const { search, index } = setup();
    try {
      await search.syncQuestion('q1');
      const call = index.mock.calls[0][0];
      expect(call).toMatchObject({
        version: 2000,
        version_type: 'external_gte',
        document: {
          questionText: 'Question text',
          groupText: 'Full passage Group transcript Second passage',
          tags: ['tag'],
        },
      });
      expect(JSON.stringify(call)).not.toContain('SECRET_ANSWER');
    } finally {
      await search.onModuleDestroy();
    }
  });
  it('writes a hidden tombstone for archives and ignores older-version conflicts', async () => {
    const { search, index } = setup(new Date(3000));
    try {
      await search.syncQuestion('q1');
      expect(index.mock.calls[0][0]).toMatchObject({
        version: 3000,
        document: { id: 'q1', deletedAt: new Date(3000) },
      });
      index.mockRejectedValueOnce({ meta: { statusCode: 409 } });
      await expect(search.syncQuestion('q1')).resolves.toBeUndefined();
      index.mockRejectedValueOnce(new Error('ES down'));
      await expect(search.syncQuestion('q1')).rejects.toThrow('ES down');
    } finally {
      await search.onModuleDestroy();
    }
  });
});
