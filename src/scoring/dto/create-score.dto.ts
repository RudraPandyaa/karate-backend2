import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ScoreType } from '@prisma/client';
import { Corner } from '../enums/corner.enum';
export class ScoreEntryDto {
  @ApiProperty({ enum: Corner })
  @IsEnum(Corner)
  corner: Corner;

  @ApiProperty({ enum: ScoreType })
  @IsEnum(ScoreType)
  type: ScoreType;
}

export class CreateScoreDto {
  @ApiProperty({
    example: 'cmf123456789'
  })
  @IsString()
  matchId: string;

  @ApiProperty({
    type: () => [ScoreEntryDto]
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ScoreEntryDto)
  entries: ScoreEntryDto[];
}