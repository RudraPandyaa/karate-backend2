import { Body, Controller, Post, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { CreateScoreDto } from './dto/create-score.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ScoringGateway } from './scoring.gateway';

@ApiTags('scoring')
@ApiBearerAuth('JWT')
@Controller('scoring')
export class ScoringController {
  constructor(
      private readonly scoringService: ScoringService,
      private readonly scoringGateway: ScoringGateway,
    ) {}

  @Public() // scoreboard screens shouldn't need a login token — decide if you actually want this open
  @Get(':id/live')
  getLive(@Param('id') id: string) {
    return this.scoringService.getMatchWithHistory(id);
  }

  @Public()
  @Get('live/all')
  getAllLive() {
    return this.scoringService.getAllLiveMatches();
  }


  @Post('exchange')
  @UseGuards(RolesGuard)
  @Roles(Role.REFEREE, Role.SCOREKEEPER, Role.ADMIN, Role.ORGANIZER)
  async recordExchange(@Body() dto: CreateScoreDto) {
    console.log(dto);

    const result = await this.scoringService.recordExchange(dto.matchId, dto);

    this.scoringGateway.server
      .to(`match-${dto.matchId}`)
      .emit('scoreUpdated', result);

    return result;
  }

  @Delete('undo')
  @UseGuards(RolesGuard)
  @Roles(Role.REFEREE, Role.SCOREKEEPER, Role.ADMIN, Role.ORGANIZER)
  async undoScore(@Body() dto: { matchId: string; scoreEventId: string }) {
    const result = await this.scoringService.undoScore(dto.matchId, dto.scoreEventId);
    this.scoringGateway.server.to(`match-${dto.matchId}`).emit('scoreUpdated', result);
    return result;
  }
}