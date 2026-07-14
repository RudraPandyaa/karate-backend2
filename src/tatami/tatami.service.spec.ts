import { Test, TestingModule } from '@nestjs/testing';
import { TatamiService } from './tatami.service';

describe('TatamiService', () => {
  let service: TatamiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TatamiService],
    }).compile();

    service = module.get<TatamiService>(TatamiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
