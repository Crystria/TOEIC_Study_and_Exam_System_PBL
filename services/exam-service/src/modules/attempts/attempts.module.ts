import { Module } from '@nestjs/common';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';
import { TestsModule } from '../tests/tests.module';
import { DraftStore } from './draft.store';
import { ScoringService } from '../../scoring/scoring.service';
import { ExpiryJob } from './expiry.job';

@Module({
  imports: [TestsModule],
  controllers: [AttemptsController],
  providers: [AttemptsService, DraftStore, ScoringService, ExpiryJob],
  exports: [AttemptsService],
})
export class AttemptsModule {}
