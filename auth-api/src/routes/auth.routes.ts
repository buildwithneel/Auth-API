
import { Router } from "express";
import {
  register,
  login,
  getProfile,
  refreshAccessToken,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  resendVerificationEmail
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";
import { authLimiter } from "../middleware/rateLimit.middleware";

const router = Router();

router.post("/register", authLimiter, register);
router.get("/verify-email", authLimiter, verifyEmail);
router.post("/resend-verification", authLimiter, resendVerificationEmail);
router.post("/login", authLimiter, login);
router.post("/refresh-token", authLimiter, refreshAccessToken);
router.post("/logout", authenticate, authLimiter, logout);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);

router.get("/profile", authenticate, getProfile);

router.get(
  "/admin",
  authenticate,
  authorizeRoles("admin"),
  (_req, res) => {
    res.status(200).json({
      success: true,
      message: "Welcome, admin!"
    });
  }
);

export default router;
