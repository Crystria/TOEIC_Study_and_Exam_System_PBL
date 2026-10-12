import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleCode, Roles } from '@toeic/common';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UsersService } from './users.service';

@ApiTags('admin-users')
@ApiBearerAuth()
@Roles(RoleCode.SYSTEM_ADMIN)
@Controller('admin')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  @ApiOperation({ summary: 'Danh sách người dùng cho quản trị' })
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.usersService.listUsers(query);
  }

  @Patch('users/:id/roles')
  @ApiOperation({ summary: 'Cập nhật vai trò' })
  updateRoles(@Param('id') id: string, @Body() dto: UpdateRolesDto) {
    return this.usersService.updateRoles(id, dto.roles);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Khóa/kích hoạt tài khoản' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.usersService.updateStatus(id, dto);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Tra cứu nhật ký hệ thống' })
  listAuditLogs(@Query('page') page = '1', @Query('size') size = '20') {
    return this.usersService.listAuditLogs(Number(page), Number(size));
  }
}
