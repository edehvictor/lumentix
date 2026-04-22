import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

describe('RegistrationsController', () => {
  let controller: RegistrationsController;

  const mockRegistrationsService = {
    register: jest.fn(),
    listForEvent: jest.fn(),
    listForUser: jest.fn(),
    cancel: jest.fn(),
    cancelWithRefund: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RegistrationsController],
      providers: [
        { provide: RegistrationsService, useValue: mockRegistrationsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RegistrationsController>(RegistrationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have JwtAuthGuard applied', () => {
    const guards = Reflect.getMetadata('__guards__', RegistrationsController);
    expect(guards).toContain(JwtAuthGuard);
  });
});
