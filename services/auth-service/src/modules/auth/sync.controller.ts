import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@toeic/common';
import { AuthService } from './auth.service';
import { SyncUserDto } from './dto/sync.dto';

@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly authService: AuthService) {}

  @Post('users')
  @ApiOperation({ summary: 'Đồng bộ trạng thái từ thiết bị (Last-Write-Wins)' })
  sync(@CurrentUser('sub') userId: string, @Body() dto: SyncUserDto) {
    return this.authService.sync(userId, dto);
  }
}
