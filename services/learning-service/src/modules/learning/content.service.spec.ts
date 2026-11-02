import { ContentService } from './content.service';
import { LearningMediaService } from './media.service';
import { ContentInput, ContentKind } from './queries';
import { PrismaService } from '../../prisma/prisma.service';

describe('Learning content PATCH validation', () => {
  const fields: Array<[ContentKind, keyof ContentInput]> = [
    ['topics', 'topicName'],
    ['vocabularies', 'word'],
    ['vocabularies', 'definition'],
    ['lessons', 'lessonTitle'],
    ['lessons', 'category'],
    ['lessons', 'contentMarkdown'],
  ];

  it.each(fields)('rejects whitespace-only %s.%s before accessing the database', async (kind, field) => {
    const transaction = jest.fn().mockResolvedValue({});
    const service = new ContentService(
      { $transaction: transaction } as unknown as PrismaService,
      {} as LearningMediaService,
    );

    for (const whitespace of ['   ', ' \t\n ', '\u00a0\u3000']) {
      await expect(
        service.patch(kind, 'content-id', { [field]: whitespace }, 'actor-id', 'correlation-id'),
      ).rejects.toMatchObject({
        status: 400,
        response: { code: 'EMPTY_CONTENT' },
      });
    }
    expect(transaction).not.toHaveBeenCalled();
  });
});
