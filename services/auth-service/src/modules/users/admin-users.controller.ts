import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RoleCode, Roles } from '@toeic/common';
import { Request } from 'express';
import { UserStatus } from '../../generated/prisma';
import { ContractPipe, auditContext } from '../../http';
import { ListUsersQueryDto, AuditQueryDto } from './dto/list-users-query.dto';
import { UsersService } from './users.service';
@ApiTags('admin-users')
@ApiBearerAuth()
@Roles(RoleCode.SYSTEM_ADMIN)
@Controller('admin')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}
  @Get('users') list(@Query() query: ListUsersQueryDto) {
    return this.users.listUsers(query);
  }
  @Patch('users/:id/roles') roles(
    @CurrentUser('sub') actor: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ContractPipe('RolesPatch')) dto: { roles: RoleCode[] },
    @Req() req: Request,
  ) {
    return this.users.change(actor, id, dto, auditContext(req));
  }
  @Patch('users/:id/status') status(
    @CurrentUser('sub') actor: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ContractPipe('StatusPatch')) dto: { status: UserStatus },
    @Req() req: Request,
  ) {
    return this.users.change(actor, id, dto, auditContext(req));
  }
  @Get('audit-logs') audit(@Query() query: AuditQueryDto) {
    return this.users.listAuditLogs(query);
  }
}
