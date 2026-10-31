import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, JwtPayload, RoleCode, Roles } from '@toeic/common';
import { PresignMediaDto } from '../questions/dto/presign-media.dto';
import { CreateGroupDto, ListGroupsDto, UpdateGroupDto } from './group.dto';
import { GroupsService } from './groups.service';
import { isContentAdmin } from '../questions/question-rules';

@Controller('question-groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}
  @Get() list(@Query() query: ListGroupsDto, @CurrentUser() user: JwtPayload) {
    return this.groups.list(query, isContentAdmin(user));
  }
  @Get(':id') find(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.groups.findById(id, isContentAdmin(user));
  }
  @Post()
  @Roles(RoleCode.CONTENT_ADMIN, RoleCode.SYSTEM_ADMIN)
  create(@Body() dto: CreateGroupDto, @CurrentUser('sub') userId: string) {
    return this.groups.create(dto, userId);
  }
  @Patch(':id')
  @Roles(RoleCode.CONTENT_ADMIN, RoleCode.SYSTEM_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groups.update(id, dto);
  }
  @Delete(':id')
  @Roles(RoleCode.CONTENT_ADMIN, RoleCode.SYSTEM_ADMIN)
  remove(@Param('id') id: string) {
    return this.groups.remove(id);
  }
  @Post(':id/media/presign')
  @Roles(RoleCode.CONTENT_ADMIN, RoleCode.SYSTEM_ADMIN)
  presign(
    @Param('id') id: string,
    @Body() dto: PresignMediaDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.groups.presign(id, dto, key);
  }
}
