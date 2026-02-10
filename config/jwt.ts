import jwt from "jsonwebtoken";
import { env } from "./env";
import type { AccessTokenPayload } from "@/types/jwt";

export function createAccessToken(payload: {
  sub: string;
  role: "user" | "admin";
}) {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
}

export function verifyAccessToken(
  token: string
): AccessTokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
  } catch {
    return null;
  }
}
