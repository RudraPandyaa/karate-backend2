import { IsOptional, IsString } from 'class-validator';

export class UndoScoreDto {
  @IsOptional()
  @IsString()
  reason?: string;
}