import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { ensureAuthenticated } from "../middlewares/ensure-authenticated.js";
import { authRateLimit } from "../middlewares/rate-limit.js";

export const authRoutes = Router();

authRoutes.post("/register", authRateLimit, authController.register);
authRoutes.post("/login", authRateLimit, authController.login);
authRoutes.post("/logout", authController.logout);
authRoutes.get("/me", ensureAuthenticated, authController.me);
