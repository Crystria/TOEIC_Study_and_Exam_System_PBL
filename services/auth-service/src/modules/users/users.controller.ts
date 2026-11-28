import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@toeic/common';
import { ContractPipe } from '../../http';
import { UsersService } from './users.service';
import { AvatarService } from './avatar.service';
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly avatars: AvatarService,
  ) {}
  @Get('me') me(@CurrentUser('sub') userId: string) {
    return this.users.getMe(userId);
  }
  @Patch('me') update(
    @CurrentUser('sub') userId: string,
    @Body(new ContractPipe('ProfilePatch')) dto: { fullName?: string; phoneNumber?: string | null },
  ) {
    return this.users.updateMe(userId, dto);
  }
  @Patch('me/avatar/presign') presign(
    @CurrentUser('sub') userId: string,
    @Body(new ContractPipe('AvatarPresignRequest'))
    dto: { kind: 'AVATAR'; contentType: string; sizeBytes: number },
  ) {
    return this.avatars.presign(userId, dto);
  }
  @Post('me/avatar/confirm') @HttpCode(200) confirm(
    @CurrentUser('sub') userId: string,
    @Body(new ContractPipe('ConfirmUploadRequest')) dto: { uploadId: string },
  ) {
    return this.avatars.confirm(userId, dto.uploadId);
  }
}
