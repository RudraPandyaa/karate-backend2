import { Role } from '@prisma/client';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;

  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
}