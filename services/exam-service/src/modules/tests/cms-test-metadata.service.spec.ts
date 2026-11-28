import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CmsTestMetadataService } from './cms-test-metadata.service';
import { ListCmsTestMetadataQueryDto } from './dto/list-cms-test-metadata-query.dto';

// Synthetic rows only; these IDs and counts are not records read from a real API/DB.
const row = {
  id: 'demo-test-001',
  title: 'Metadata fixture',
  type: 'FULL',
  durationSeconds: 61,
  status: 'REVIEW_PENDING',
  _count: { questions: 2 },
};
const keys = ['id', 'title', 'type', 'durationSeconds', 'questionCount', 'status'].sort();

describe('CmsTestMetadataService (Prisma stub, no DB)', () => {
  const prisma = {
    test: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new CmsTestMetadataService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.test.findMany.mockResolvedValue([row]);
    prisma.test.count.mockResolvedValue(1);
    prisma.test.findFirst.mockResolvedValue(row);
    prisma.$transaction.mockImplementation((queries: Promise<unknown>[]) => Promise.all(queries));
  });

  it('projects exactly six keys without leaking even unexpected extra stub columns', async () => {
    const extra = {
      ...row,
      createdBy: 'excluded-fixture-value',
      createdAt: new Date(0),
      questions: [{ questionId: 'same-id' }, { questionId: 'same-id' }],
      _count: { questions: 2, attempts: 99 },
    };
    prisma.test.findMany.mockResolvedValue([extra]);
    prisma.test.findFirst.mockResolvedValue(extra);
    const list = await service.list(new ListCmsTestMetadataQueryDto());
    const detail = await service.findById(row.id);
    expect(Object.keys(detail).sort()).toEqual(keys);
    expect(detail).toEqual({
      id: row.id,
      title: row.title,
      type: null,
      durationSeconds: 61,
      questionCount: 2,
      status: null,
    });
    expect(list).toEqual({ items: [detail], total: 1, page: 1, size: 20 });
    const listQuery = prisma.test.findMany.mock.calls[0][0];
    const detailQuery = prisma.test.findFirst.mock.calls[0][0];
    expect(listQuery.select).toEqual(detailQuery.select);
    expect(Object.keys(listQuery.select).sort()).toEqual(
      ['id', 'title', 'durationSeconds', '_count'].sort(),
    );
    expect(listQuery.select._count).toEqual({ select: { questions: true } });
    expect(listQuery).not.toHaveProperty('include');
    expect(detailQuery).not.toHaveProperty('include');
    expect(listQuery).not.toHaveProperty('distinct');
  });

  it('applies AND filters and pagination to items and total without demo fields', async () => {
    const query = Object.assign(new ListCmsTestMetadataQueryDto(), {
      keyword: 'Bộ đề',
      page: 4,
      size: 7,
    });
    prisma.test.count.mockResolvedValue(30);
    const result = await service.list(query);
    const where = {
      deletedAt: null,
      title: { contains: 'Bộ đề', mode: 'insensitive' },
    };
    expect(prisma.test.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: 21,
        take: 7,
      }),
    );
    expect(prisma.test.count).toHaveBeenCalledWith({ where });
    expect(result).toEqual(expect.objectContaining({ total: 30, page: 4, size: 7 }));
    expect(Object.keys(result).sort()).toEqual(['items', 'total', 'page', 'size'].sort());
  });

  it.each([0, 1])('keeps an empty past-end page and filtered total=%i', async (total) => {
    prisma.test.findMany.mockResolvedValue([]);
    prisma.test.count.mockResolvedValue(total);
    expect(
      await service.list(Object.assign(new ListCmsTestMetadataQueryDto(), { page: 9 })),
    ).toEqual({
      items: [],
      total,
      page: 9,
      size: 20,
    });
  });

  it.each(['FULL', 'MINI'])(
    'preserves zero linked rows and explicit duration for %s',
    async (type) => {
      prisma.test.findFirst.mockResolvedValue({
        ...row,
        type,
        durationSeconds: 123,
        _count: { questions: 0 },
      });
      expect(await service.findById(row.id)).toEqual(
        expect.objectContaining({
          type: null,
          status: null,
          durationSeconds: 123,
          questionCount: 0,
        }),
      );
    },
  );

  it.each([
    {
      title: undefined,
      type: undefined,
      durationSeconds: undefined,
      status: undefined,
      _count: undefined,
    },
    { title: '  ', type: 'FULL_TEST', durationSeconds: 0, status: '', _count: { questions: -1 } },
    { title: null, type: null, durationSeconds: 1.5, status: null, _count: { questions: 1.5 } },
  ])('normalizes unsupported or missing metadata without inventing values: %#', async (fields) => {
    prisma.test.findFirst.mockResolvedValue({ ...row, ...fields });
    expect(await service.findById(row.id)).toEqual({
      id: row.id,
      title: null,
      type: null,
      durationSeconds: null,
      questionCount: null,
      status: null,
    });
  });

  it.each(['', '  ', undefined])(
    'rejects an invalid stored ID instead of inventing one: %s',
    async (id) => {
      prisma.test.findFirst.mockResolvedValue({ ...row, id });
      await expect(service.findById(row.id)).rejects.toBeInstanceOf(InternalServerErrorException);
    },
  );

  it('returns 404 for an absent Test, not a nullable metadata item', async () => {
    prisma.test.findFirst.mockResolvedValue(null);
    await expect(service.findById('absent')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('propagates list query failures without a demo or null fallback', async () => {
    const failure = new Error('isolated query failure');
    prisma.test.findMany.mockRejectedValue(failure);
    await expect(service.list(new ListCmsTestMetadataQueryDto())).rejects.toBe(failure);
  });

  it('propagates detail query failures without returning 404 or metadata', async () => {
    const failure = new Error('isolated query failure');
    prisma.test.findFirst.mockRejectedValue(failure);
    await expect(service.findById(row.id)).rejects.toBe(failure);
  });
});
