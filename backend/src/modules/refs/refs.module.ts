import { Module } from '@nestjs/common';
import { RefsController } from './refs.controller';

@Module({
  controllers: [RefsController],
})
export class RefsModule {}
