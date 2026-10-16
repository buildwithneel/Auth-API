import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50),
  email: z.string().trim().email("Enter a valid email address").toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters").max(72)
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").toLowerCase(),
  password: z.string().min(1, "Password is required")
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required")
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required")
});
