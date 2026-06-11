import { Global, Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { SystemStatusService } from './system-status.service';

@Global()
@Module({
  controllers: [SystemController],
  providers: [SystemStatusService],
  exports: [SystemStatusService],
})
export class SystemModule {}
