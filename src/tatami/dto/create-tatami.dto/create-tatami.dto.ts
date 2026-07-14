import { IsString, IsInt,  IsOptional } from 'class-validator';

export class CreateTatamiDto {
  @IsString()
  tournamentId: string;

  @IsInt()
  number: number;

  @IsOptional()
  @IsString()
  name?: string;
}