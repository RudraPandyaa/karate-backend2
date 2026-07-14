import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from '../../tournaments/dto/create-category.dto';

// PATCH /categories/:id — all fields optional.
// Using @nestjs/swagger's PartialType (rather than @nestjs/mapped-types)
// so the generated Swagger docs stay accurate, matching the pattern your
// UpdateTournamentDto presumably already follows.
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}