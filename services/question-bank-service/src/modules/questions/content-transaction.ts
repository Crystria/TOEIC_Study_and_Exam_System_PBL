import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

// Content writes are infrequent. Serialize them across replicas so membership/reorder
// validation and archive cascades see a stable group, not competing partial edits.
export function contentTransaction<T>(
  prisma: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(26002702)`;
      return work(tx);
    },
    { timeout: 30_000 },
  );
}
