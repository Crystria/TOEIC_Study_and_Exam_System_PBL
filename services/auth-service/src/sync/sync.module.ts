import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { LearningClient } from './learning-client';
@Module({ controllers: [SyncController], providers: [SyncService, LearningClient] })
export class SyncModule {}
