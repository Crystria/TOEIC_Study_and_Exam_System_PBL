import { Module } from '@nestjs/common';
import { SearchIndexer } from './search-indexer';
import { SearchService } from './search.service';

@Module({
  providers: [SearchService, SearchIndexer],
  exports: [SearchService],
})
export class SearchModule {}
