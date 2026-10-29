import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { CmsTestMetadataDto, CmsTestMetadataPageDto } from './dto/cms-test-metadata-response.dto';
import { ListTestsQueryDto } from './dto/list-tests-query.dto';

const metadataSelect = {
  id: true,
  title: true,
  type: true,
  durationSeconds: true,
  status: true,
  _count: { select: { questions: true } },
} satisfies Prisma.TestSelect;

type MetadataRow = Prisma.TestGetPayload<{ select: typeof metadataSelect }>;

const nullableText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

function projectMetadata(row: MetadataRow): CmsTestMetadataDto {
  if (nullableText(row.id) === null) {
    throw new InternalServerErrorException('Invalid test metadata ID');
  }
  const count = row._count?.questions;
  return {
    id: row.id,
    title: nullableText(row.title),
    type: row.type === 'FULL' || row.type === 'MINI' ? row.type : null,
    durationSeconds:
      Number.isInteger(row.durationSeconds) && row.durationSeconds > 0 ? row.durationSeconds : null,
    questionCount: Number.isInteger(count) && count >= 0 ? count : null,
    status: nullableText(row.status),
  };
}

@Injectable()
export class CmsTestMetadataService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListTestsQueryDto): Promise<CmsTestMetadataPageDto> {
    const where: Prisma.TestWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword
        ? { title: { contains: query.keyword, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.test.findMany({
        where,
        select: metadataSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.size,
        take: query.size,
      }),
      this.prisma.test.count({ where }),
    ]);
    return { items: items.map(projectMetadata), total, page: query.page, size: query.size };
  }

  async findById(id: string): Promise<CmsTestMetadataDto> {
    const test = await this.prisma.test.findUnique({ where: { id }, select: metadataSelect });
    if (!test) throw new NotFoundException('Test not found');
    return projectMetadata(test);
  }
}
