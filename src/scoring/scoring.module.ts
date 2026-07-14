import { Module } from '@nestjs/common';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScoringGateway } from './scoring.gateway';

@Module({
  imports: [PrismaModule],
  controllers: [ScoringController],
  providers: [ScoringService, ScoringGateway],
  exports: [ScoringService],
})
export class ScoringModule {}