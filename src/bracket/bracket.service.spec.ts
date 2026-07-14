import { Test, TestingModule } from '@nestjs/testing';
import { BracketService } from './bracket.service';

describe('BracketService', () => {
  let service: BracketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BracketService],
    }).compile();

    service = module.get<BracketService>(BracketService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
