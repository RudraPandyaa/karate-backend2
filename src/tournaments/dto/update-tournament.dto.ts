import { PartialType } from '@nestjs/mapped-types';
import { CreateTournamentDto } from './create-tournament.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { TournamentStatus } from '@prisma/client';

export class UpdateTournamentDto extends PartialType(CreateTournamentDto) {
  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;
}