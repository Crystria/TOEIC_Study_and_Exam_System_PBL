import { Module } from '@nestjs/common';
import { CmsTestMetadataController } from './cms-test-metadata.controller';
import { CmsTestMetadataRolesGuard } from './cms-test-metadata-roles.guard';
import { CmsTestMetadataService } from './cms-test-metadata.service';
import { TestsController } from './tests.controller';
import { TestsService } from './tests.service';

@Module({
  // Register the static CMS prefix before the legacy /tests/:id route.
  controllers: [CmsTestMetadataController, TestsController],
  providers: [TestsService, CmsTestMetadataService, CmsTestMetadataRolesGuard],
  exports: [TestsService],
})
export class TestsModule {}
