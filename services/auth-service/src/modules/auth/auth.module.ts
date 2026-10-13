import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { SyncController } from './sync.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController, SyncController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
