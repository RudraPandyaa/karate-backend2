import { Test, TestingModule } from '@nestjs/testing';
import { ScoringGateway } from './scoring.gateway';

describe('ScoringGateway', () => {
  let gateway: ScoringGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScoringGateway],
    }).compile();

    gateway = module.get<ScoringGateway>(ScoringGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
