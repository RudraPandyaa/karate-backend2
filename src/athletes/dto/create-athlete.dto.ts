import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateAthleteDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsOptional()
  @IsString()
  country?: string;
}