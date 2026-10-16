import { Router } from "express";
import {
  register,
  login,
  getProfile,
  refreshAccessToken
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorizeRoles } from "../middleware/role.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshAccessToken);
router.get("/profile", authenticate, getProfile);
router.get("/admin", authenticate, authorizeRoles("admin"), (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome, admin!"
  });
});

export default router;
