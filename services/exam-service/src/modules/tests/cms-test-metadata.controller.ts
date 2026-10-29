import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RoleCode, Roles } from '@toeic/common';
import { CmsTestMetadataRolesGuard } from './cms-test-metadata-roles.guard';
import { CmsTestMetadataService } from './cms-test-metadata.service';
import { CmsTestMetadataDto, CmsTestMetadataPageDto } from './dto/cms-test-metadata-response.dto';
import { ListTestsQueryDto } from './dto/list-tests-query.dto';

@ApiTags('tests')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT missing or invalid at Gateway or Exam.' })
@ApiForbiddenResponse({ description: 'CONTENT_ADMIN must be present in the roles array.' })
@ApiTooManyRequestsResponse({ description: 'Gateway rate limit, before JWT/proxy.' })
@ApiInternalServerErrorResponse({ description: 'Metadata could not be read; no demo fallback.' })
@Roles(RoleCode.CONTENT_ADMIN)
@UseGuards(CmsTestMetadataRolesGuard)
@Controller('tests/cms-metadata')
export class CmsTestMetadataController {
  constructor(private readonly metadataService: CmsTestMetadataService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách metadata đề thi CMS (CONTENT_ADMIN)' })
  @ApiQuery({ name: 'keyword', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: ['FULL', 'MINI'] })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', minimum: 1, default: 1 } })
  @ApiQuery({
    name: 'size',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
  })
  @ApiBadRequestResponse({ description: 'Invalid or unknown list query parameters.' })
  @ApiOkResponse({ type: CmsTestMetadataPageDto })
  list(@Query() query: ListTestsQueryDto): Promise<CmsTestMetadataPageDto> {
    return this.metadataService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết metadata đề thi CMS (CONTENT_ADMIN)' })
  @ApiParam({ name: 'id', type: String, description: 'Opaque Test ID; not restricted to UUID.' })
  @ApiNotFoundResponse({ description: 'Test not found.' })
  @ApiOkResponse({ type: CmsTestMetadataDto })
  findById(@Param('id') id: string): Promise<CmsTestMetadataDto> {
    return this.metadataService.findById(id);
  }
}
