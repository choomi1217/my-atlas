export type UserRole = 'ADMIN' | 'USER';

export interface AuthUser {
  username: string;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  role: UserRole;
  sessionTimeoutSeconds: number;
}

export interface PublicSettings {
  loginRequired: boolean;
}
