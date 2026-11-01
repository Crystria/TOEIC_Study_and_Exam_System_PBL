import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { SyncController } from './sync.controller';
import { AuthService } from './auth.service';
import { ActivationMailService } from './activation-mail.service';
import { AvatarService } from '../users/avatar.service';
import { UserPresenter } from '../users/user-presenter';
import { InternalAuthController } from './internal-auth.controller';

@Module({
  controllers: [AuthController, SyncController, InternalAuthController],
  providers: [AuthService, ActivationMailService, AvatarService, UserPresenter],
  exports: [AuthService, AvatarService, UserPresenter, ActivationMailService],
})
export class AuthModule {}
