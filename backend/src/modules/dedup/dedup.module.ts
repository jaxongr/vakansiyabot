import { Module } from '@nestjs/common';
import { NormalizeService } from './normalize.service';
import { MatcherService } from './matcher.service';

@Module({
  providers: [NormalizeService, MatcherService],
  exports: [NormalizeService, MatcherService],
})
export class DedupModule {}
