import { SignJWT } from "jose";

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET undefined");

const key = new TextEncoder().encode(secret);

export const ACCESS_TOKEN_TTL_SECONDS = 5 * 60 * 60;

export function signAccessToken(userId: string) {
  return new SignJWT()
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key);
}
