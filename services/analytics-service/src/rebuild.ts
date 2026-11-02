import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppConfigModule } from '@toeic/common';
import { validateRequest } from '@toeic/contracts/p0/runtime.cjs';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { ProjectionService } from './modules/analytics/projection.service';
import { AnalyticsQueries } from './modules/analytics/analytics.queries';
import { AnalyticsClock } from './modules/analytics/calculations';
@Module({
  imports: [AppConfigModule, PrismaModule],
  providers: [ProjectionService, AnalyticsQueries, AnalyticsClock],
})
class MaintenanceModule {}
async function run() {
  const args = process.argv.slice(2);
  if (!(args.length === 1 && args[0] === '--all') && !(args.length === 2 && args[0] === '--user'))
    throw Error('Use --all or --user <UUID>');
  if (args[0] === '--user') validateRequest('Uuid', args[1]);
  const app = await NestFactory.createApplicationContext(MaintenanceModule);
  try {
    const db = app.get(PrismaService),
      projection = app.get(ProjectionService);
    let count = 0;
    if (args[0] === '--user') {
      await projection.rebuild(args[1]);
      count = 1;
    } else {
      let after = '';
      for (;;) {
        const rows = await db.$queryRaw<
          Array<{ user_id: string }>
        >`SELECT DISTINCT user_id FROM learning_activity_facts WHERE user_id>${after} ORDER BY user_id LIMIT 100`;
        if (!rows.length) break;
        for (const row of rows) {
          await projection.rebuild(row.user_id);
          count++;
        }
        after = rows.at(-1)!.user_id;
      }
    }
    console.log(`Rebuilt ${count} Analytics users from local immutable facts.`);
  } finally {
    await app.close();
  }
}
if (require.main === module)
  run().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
