import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import RefreshToken from "../models/RefreshToken";
import { hashPassword, comparePassword } from "../utils/password";
import { generateAccessToken, generateRefreshToken } from "../utils/token";
import { hashRefreshToken, getRefreshTokenExpiry } from "../utils/refreshToken";
import { registerSchema, loginSchema, refreshTokenSchema } from "../validators/auth.validator";
import { AuthRequest } from "../middleware/auth.middleware";

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: "Invalid input",
        errors: result.error.issues
      });
      return;
    }

    const { name, email, password } = result.data;
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "Email is already registered"
      });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
      name,
      email,
      password: hashedPassword
    });

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: getRefreshTokenExpiry()
    });

    res.status(201).json({
      success: true,
      message: "Registration successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: "Invalid input",
        errors: result.error.issues
      });
      return;
    }

    const { email, password } = result.data;
    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await comparePassword(password, user.password))) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
      return;
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: getRefreshTokenExpiry()
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const getProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = await User.findById(req.user?.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const refreshAccessToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  const result = refreshTokenSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid input",
      errors: result.error.issues
    });
    return;
  }

  try {
    const secret = process.env.JWT_REFRESH_SECRET;

    if (!secret) {
      res.status(500).json({
        success: false,
        message: "Server configuration error"
      });
      return;
    }

    const decoded = jwt.verify(result.data.refreshToken, secret);

    if (typeof decoded === "string" || typeof decoded.userId !== "string") {
      res.status(401).json({
        success: false,
        message: "Invalid refresh token"
      });
      return;
    }

    const tokenHash = hashRefreshToken(result.data.refreshToken);

    const storedToken = await RefreshToken.findOne({
      userId: decoded.userId,
      tokenHash,
      revoked: false,
      expiresAt: { $gt: new Date() }
    });

    if (!storedToken) {
      res.status(401).json({
        success: false,
        message: "Refresh token is invalid, expired, or revoked"
      });
      return;
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User no longer exists"
      });
      return;
    }

    const accessToken = generateAccessToken(user.id, user.role);

    res.status(200).json({
      success: true,
      accessToken
    });
  } catch {
    res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token"
    });
  }
};
