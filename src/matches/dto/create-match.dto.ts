import { IsString, IsOptional, IsInt, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MatchStatus, SenshuHolder } from '@prisma/client';
import { MatchRound } from '@prisma/client';
export class CreateMatchDto {
  @ApiProperty()
  @IsString()
  categoryId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tatamiId?: string;

  @ApiProperty()
  @IsString()
  round: MatchRound;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  bracketSlot?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  redAthleteId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  blueAthleteId?: string;

  @ApiProperty({ enum: MatchStatus, default: 'SCHEDULED' })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  timerSeconds?: number;
}