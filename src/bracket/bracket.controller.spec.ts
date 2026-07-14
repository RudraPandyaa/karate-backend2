import { Test, TestingModule } from '@nestjs/testing';
import { BracketController } from './bracket.controller';

describe('BracketController', () => {
  let controller: BracketController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BracketController],
    }).compile();

    controller = module.get<BracketController>(BracketController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
