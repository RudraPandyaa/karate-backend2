import { Module } from '@nestjs/common';
import { CategoriesController } from './category.controller';
import { CategoriesService } from './category.service';
import { PrismaModule } from '../prisma/prisma.module';

// ASSUMPTION: PrismaModule is @Global() (common setup) — if not, import it
// here explicitly as shown. Remember to also add CategoriesModule to your
// AppModule's `imports` array or these routes won't be registered at all.
@Module({
  imports: [PrismaModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}