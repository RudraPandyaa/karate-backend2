import { IsString, IsOptional, IsInt, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MatchStatus, MatchRound } from '@prisma/client';

export class UpdateMatchDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(MatchRound)
  round?: MatchRound;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  redScore?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  blueScore?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  winnerId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  timeRemaining?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  timerSeconds?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tatamiId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  refereeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  scorekeeperId?: string;
}