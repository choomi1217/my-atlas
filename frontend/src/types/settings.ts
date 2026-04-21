export interface SystemSettings {
  aiEnabled: boolean;
  sessionTimeoutSeconds: number;
  loginRequired: boolean;
  aiRateLimitPerIp: number;
  aiRateLimitWindowSeconds: number;
}

export interface CompanyInfo {
  id: number;
  name: string;
}

export interface UserWithCompanies {
  id: number;
  username: string;
  role: string;
  companies: CompanyInfo[];
  createdAt: string;
}

export interface RegisterUserRequest {
  username: string;
  password: string;
  companyIds: number[];
}

export interface UpdateSettingsRequest {
  aiEnabled?: boolean;
  sessionTimeoutSeconds?: number;
  loginRequired?: boolean;
  aiRateLimitPerIp?: number;
  aiRateLimitWindowSeconds?: number;
}

export interface UpdateCompaniesRequest {
  companyIds: number[];
}
