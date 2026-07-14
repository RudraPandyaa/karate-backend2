import { Module } from '@nestjs/common';
import { TatamiService } from './tatami.service';
import { TatamiController } from './tatami.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TatamiController],
  providers: [TatamiService],
  exports: [TatamiService],
})
export class TatamiModule {}