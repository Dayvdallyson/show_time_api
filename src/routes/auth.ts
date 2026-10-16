import { Router, type Response } from "express";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client";
import { ACCESS_TOKEN_TTL_SECONDS, signAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

export const authRouter = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const ACCESS_TOKEN_COOKIE = "access_token";

const DUMMY_PASSWORD_HASH = await Bun.password.hash("dummy-password-for-timing");

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(255));

const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

async function setAccessTokenCookie(res: Response, userId: string) {
  const token = await signAccessToken(userId);
  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
}

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid data", issues: z.flattenError(parsed.error).fieldErrors });
    return;
  }

  const { email, password } = parsed.data;
  const passwordHash = await Bun.password.hash(password);

  try {
    const user = await prisma.user.create({ data: { email, passwordHash } });
    await setAccessTokenCookie(res, user.id);
    res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    throw err;
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid data", issues: z.flattenError(parsed.error).fieldErrors });
    return;
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = await Bun.password.verify(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  const isLocked = user?.lockedUntil != null && user.lockedUntil > new Date();
  if (!user || isLocked || !passwordMatches) {
    if (user && !isLocked) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
      });
      if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) },
        });
      }
    }
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  await setAccessTokenCookie(res, user.id);
  res.status(200).json({ id: user.id, email: user.email });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: "/" });
  res.status(204).end();
});
