import { Test, TestingModule } from '@nestjs/testing';
import { TatamiController } from './tatami.controller';

describe('TatamiController', () => {
  let controller: TatamiController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TatamiController],
    }).compile();

    controller = module.get<TatamiController>(TatamiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
