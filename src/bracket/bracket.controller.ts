import { Controller, Post, Body, Param, Get, UseGuards } from '@nestjs/common';
import { BracketService } from './bracket.service';
import { GenerateBracketDto, AssignMatchesToTatamiDto } from './dto/generate-bracket.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('bracket')
@ApiBearerAuth('JWT')
@Controller('bracket')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BracketController {
  constructor(private readonly bracketService: BracketService) {}

  @Post('generate')
  @Roles(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN)
  async generateBracket(@Body() dto: GenerateBracketDto) {
    return this.bracketService.generateBracket(dto);
  }

  @Post('tatami/:tatamiId/assign')
  @Roles(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN)
  async assignToTatami(
    @Param('tatamiId') tatamiId: string,
    @Body() dto: AssignMatchesToTatamiDto,
  ) {
    return this.bracketService.assignMatchesToTatami(tatamiId, dto.matchIds);
  }

  @Public()
  @Get('tatami/:tatamiId')
  async getTatamiSchedule(@Param('tatamiId') tatamiId: string) {
    return this.bracketService.getTatamiSchedule(tatamiId);
  }

  @Public()
  @Get('category/:categoryId')
  async getCategoryBracket(@Param('categoryId') categoryId: string) {
    return this.bracketService.getCategoryBracket(categoryId);
  }
}