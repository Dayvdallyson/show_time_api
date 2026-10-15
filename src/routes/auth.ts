import { Router } from "express";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const { email, password } = req.body ?? {};
  console.log("[auth] login payload recebido:", {
    email,
    passwordProvided: Boolean(password),
    passwordLength: typeof password === "string" ? password.length : undefined
  });

  res.status(200).json({ status: "ok" });
});
