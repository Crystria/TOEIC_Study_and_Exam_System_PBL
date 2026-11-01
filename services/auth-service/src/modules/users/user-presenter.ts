import { Injectable } from '@nestjs/common';
import { IdentityUser } from '../../identity';
import { AvatarService } from './avatar.service';
@Injectable()
export class UserPresenter {
  constructor(private readonly avatars: AvatarService) {}
  async present(user: IdentityUser) {
    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      avatarKey: user.avatarKey,
      avatarUrl: await this.avatars.url(user.avatarKey),
      status: user.status,
      roles: user.roles.map((r) => r.roleCode).sort(),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
