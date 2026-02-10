import type { JwtPayload as BaseJwtPayload } from "jsonwebtoken";

export interface AccessTokenPayload extends BaseJwtPayload {
  sub: string; 
  role: "user" | "admin";
}
