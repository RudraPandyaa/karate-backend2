import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { TatamiService } from './tatami.service';
import { CreateTatamiDto} from './dto/create-tatami.dto/create-tatami.dto';
import { UpdateTatamiDto } from './dto/update-tatami.dto/update-tatami.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('tatami')
@ApiBearerAuth('JWT')
@Controller('tatami')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TatamiController {
  constructor(private readonly tatamiService: TatamiService) {}

  @Post()
  @Roles(Role.ORGANIZER, Role.ADMIN)
  create(@Body() dto: CreateTatamiDto) {
    return this.tatamiService.create(dto);
  }

  @Post(':tournamentId/auto-assign')
  @Roles(Role.ADMIN, Role.ORGANIZER)
  autoAssign(@Param('tournamentId') tournamentId: string) {
    return this.tatamiService.autoAssign(tournamentId);
  }

  @Get(':id/queue')
  getQueue(@Param('id') id: string) {
    return this.tatamiService.getQueue(id);
  }
  
  @Get('tournament/:tournamentId')
  findByTournament(@Param('tournamentId') tournamentId: string) {
    return this.tatamiService.findByTournament(tournamentId);
  }
  
  @Get()
  findAll() {
    return this.tatamiService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tatamiService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ORGANIZER, Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateTatamiDto) {
    return this.tatamiService.update(id, dto);
  }

  @Patch(':id/assign-match')
  @Roles(Role.ADMIN, Role.ORGANIZER)
  assignMatch(
    @Param('id') id: string,
    @Body() dto: { matchId: string },
  ) {
    return this.tatamiService.assignMatch(id, dto.matchId);
  }

  @Delete(':id')
  @Roles(Role.ORGANIZER, Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.tatamiService.remove(id);
  }
}