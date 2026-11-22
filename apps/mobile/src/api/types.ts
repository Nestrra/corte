/** `User` schema of contracts/auth.openapi.yaml. */
export interface User {
  id: string;
  name: string;
  email: string;
  timezone: string;
  mustChangePassword: boolean;
}

/** Response of register, login and refresh (contracts/auth.openapi.yaml → AuthResult). */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}
