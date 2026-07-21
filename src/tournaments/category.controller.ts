import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './category.service';
import { CreateCategoryDto } from '../tournaments/dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { RegisterAthleteDto } from './dto/register-athlete';
// NOTE: CreateCategoryDto currently lives under tournaments/dto because it
// was only used by TournamentsController's nested POST route. Adjust the
// import path if you move/duplicate it into categories/dto instead.

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ORGANIZER)
  @Post(':categoryId/athletes')
  registerAthlete(
    @Param('categoryId') categoryId: string,
    @Body() dto: RegisterAthleteDto,
  ) {
    return this.categoriesService.registerAthlete(
      categoryId,
      dto,
    );
  }

  // GET /categories?search=...
  // Matches useCategories()'s `refresh()` — frontend currently filters
  // client-side, but `search` is accepted here too for parity with
  // useAthletes()'s fetchAthletes(search).
  @Public()
  @Get()
  findAll(@Query('search') search?: string) {
    return this.categoriesService.findAll(search);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  // Kept here for a flat create option in addition to the nested
  // POST /tournaments/:id/categories route already on TournamentsController.
  // Remove this if you want category creation to only ever happen through
  // the tournament, to avoid having two ways to create the same resource.
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ORGANIZER)
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ORGANIZER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.ORGANIZER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}