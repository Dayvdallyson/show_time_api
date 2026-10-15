import express from "express";
import { authRouter } from "./routes/auth";
export const app = express();

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "This is the check" });
});

app.use("/api/auth", authRouter);
