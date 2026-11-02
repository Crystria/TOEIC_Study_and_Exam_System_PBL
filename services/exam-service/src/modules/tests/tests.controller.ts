import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload, RoleCode, Roles } from '@toeic/common';
import { CreateTestDto } from './dto/create-test.dto';
import { ListTestsQueryDto } from './dto/list-tests-query.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { TestsService } from './tests.service';

@ApiTags('tests')
@Controller('tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách đề thi hoàn chỉnh 7 Part' })
  list(@Query() query: ListTestsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.testsService.list(
      query,
      user.roles.some((r) => r === RoleCode.CONTENT_ADMIN || r === RoleCode.SYSTEM_ADMIN),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết cấu trúc đề thi' })
  findById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.testsService.findById(
      id,
      user.roles.some((r) => r === RoleCode.CONTENT_ADMIN || r === RoleCode.SYSTEM_ADMIN),
    );
  }

  @ApiBearerAuth()
  @Roles(RoleCode.SYSTEM_ADMIN, RoleCode.CONTENT_ADMIN)
  @Post()
  @ApiOperation({ summary: 'Tạo đề thi' })
  create(@Body() dto: CreateTestDto, @CurrentUser('sub') userId: string) {
    return this.testsService.create(dto, userId);
  }

  @ApiBearerAuth()
  @Roles(RoleCode.SYSTEM_ADMIN, RoleCode.CONTENT_ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật đề thi / cấu trúc' })
  update(@Param('id') id: string, @Body() dto: UpdateTestDto) {
    return this.testsService.update(id, dto);
  }
  @Delete(':id')
  @Roles(RoleCode.CONTENT_ADMIN, RoleCode.SYSTEM_ADMIN)
  remove(@Param('id') id: string) {
    return this.testsService.remove(id);
  }
}
