import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload, RoleCode, Roles } from '@toeic/common';
import { isContentAdmin } from './question-rules';
import { SearchService } from '../search/search.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { ListQuestionsQueryDto } from './dto/list-questions-query.dto';
import { PresignMediaDto } from './dto/presign-media.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionsService } from './questions.service';

@ApiTags('questions')
@Controller('questions')
export class QuestionsController {
  constructor(
    private readonly questionsService: QuestionsService,
    private readonly search: SearchService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Tìm kiếm/lọc câu hỏi (keyword, part, difficulty, tag)' })
  list(@Query() query: ListQuestionsQueryDto, @CurrentUser() user: JwtPayload) {
    return this.questionsService.list(query, isContentAdmin(user));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết câu hỏi' })
  findById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.questionsService.findById(id, isContentAdmin(user));
  }

  @ApiBearerAuth()
  @Roles(RoleCode.SYSTEM_ADMIN, RoleCode.CONTENT_ADMIN)
  @Post()
  @ApiOperation({ summary: 'Tạo câu hỏi' })
  create(@Body() dto: CreateQuestionDto, @CurrentUser('sub') userId: string) {
    return this.questionsService.create(dto, userId);
  }

  @ApiBearerAuth()
  @Roles(RoleCode.SYSTEM_ADMIN, RoleCode.CONTENT_ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật câu hỏi' })
  update(@Param('id') id: string, @Body() dto: UpdateQuestionDto) {
    return this.questionsService.update(id, dto);
  }

  @ApiBearerAuth()
  @Roles(RoleCode.SYSTEM_ADMIN, RoleCode.CONTENT_ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa/ngưng sử dụng câu hỏi' })
  remove(@Param('id') id: string) {
    return this.questionsService.remove(id);
  }

  @ApiBearerAuth()
  @Roles(RoleCode.SYSTEM_ADMIN, RoleCode.CONTENT_ADMIN)
  @Post(':id/media/presign')
  @ApiOperation({ summary: 'Tạo presigned URL để upload media lên S3/MinIO' })
  presign(
    @Param('id') id: string,
    @Body() dto: PresignMediaDto,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.questionsService.presign(id, dto, key);
  }

  @Post('reindex')
  @Roles(RoleCode.SYSTEM_ADMIN)
  reindex() {
    return this.search.reindex();
  }
}
