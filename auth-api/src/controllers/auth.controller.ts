import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import RefreshToken from "../models/RefreshToken";
import { hashPassword, comparePassword } from "../utils/password";
import { generateAccessToken, generateRefreshToken } from "../utils/token";
import { hashRefreshToken, getRefreshTokenExpiry } from "../utils/refreshToken";
import {
  generateEmailVerificationToken,
  hashEmailVerificationToken,
  getEmailVerificationExpiry
} from "../utils/emailVerification";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  getPasswordResetExpiry
} from "../utils/passwordReset";
import { sendEmail } from "../services/email.service";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema
} from "../validators/auth.validator";
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
    const verificationToken = generateEmailVerificationToken();
    const verificationTokenHash = hashEmailVerificationToken(verificationToken);
    const verificationExpiry = getEmailVerificationExpiry();
    const verificationUrl = process.env.EMAIL_VERIFICATION_URL;

    if (!verificationUrl) {
      res.status(500).json({
        success: false,
        message: "Email verification is not configured"
      });
      return;
    }

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      isEmailVerified: false,
      emailVerificationToken: verificationTokenHash,
      emailVerificationExpires: verificationExpiry
    });

    const verificationLink = `${verificationUrl}?token=${encodeURIComponent(verificationToken)}`;

    try {
      await sendEmail(
        email,
        "Verify your email address",
        `Hello ${name},\n\nPlease verify your email address by opening this link:\n${verificationLink}\n\nThis link expires in 15 minutes.\n\nIf you did not create this account, you can ignore this email.`,
        `<p>Hello ${name},</p><p>Please verify your email address by clicking the link below:</p><p><a href="${verificationLink}">Verify Email</a></p><p>This link expires in 15 minutes.</p><p>If you did not create this account, you can ignore this email.</p>`
      );
    } catch (emailError) {
      await User.findByIdAndDelete(user._id);
      throw emailError;
    }

    res.status(201).json({
      success: true,
      message: "Registration successful. Check your email to verify your account."
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again later."
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

    if (!user.isEmailVerified) {
      res.status(403).json({
        success: false,
        message: "Please verify your email before logging in"
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
        isEmailVerified: user.isEmailVerified,
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

    if (!user.isEmailVerified) {
      res.status(403).json({
        success: false,
        message: "Please verify your email before refreshing tokens"
      });
      return;
    }

    const newRefreshToken = generateRefreshToken(user.id);
    const newTokenHash = hashRefreshToken(newRefreshToken);

    storedToken.revoked = true;
    await storedToken.save();

    await RefreshToken.create({
      userId: user._id,
      tokenHash: newTokenHash,
      expiresAt: getRefreshTokenExpiry()
    });

    const accessToken = generateAccessToken(user.id, user.role);

    res.status(200).json({
      success: true,
      message: "Tokens refreshed successfully",
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token"
      });
      return;
    }

    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to refresh tokens right now"
    });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const result = logoutSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid input",
      errors: result.error.issues
    });
    return;
  }

  try {
    const tokenHash = hashRefreshToken(result.data.refreshToken);

    const token = await RefreshToken.findOneAndUpdate(
      {
        tokenHash,
        revoked: false,
        expiresAt: { $gt: new Date() }
      },
      {
        $set: { revoked: true }
      },
      { new: true }
    );

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Refresh token is invalid, expired, or already revoked"
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Logout successful"
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const verifyEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  const token = req.query.token;

  if (typeof token !== "string" || !token) {
    res.status(400).json({
      success: false,
      message: "Verification token is required"
    });
    return;
  }

  try {
    const tokenHash = hashEmailVerificationToken(token);

    const user = await User.findOne({
      emailVerificationToken: tokenHash,
      emailVerificationExpires: { $gt: new Date() },
      isEmailVerified: false
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (!user) {
      res.status(400).json({
        success: false,
        message: "Verification link is invalid, expired, or already used"
      });
      return;
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully. You can now log in."
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  const result = forgotPasswordSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid input",
      errors: result.error.issues
    });
    return;
  }

  try {
    const { email } = result.data;
    const user = await User.findOne({ email });

    if (user && user.isEmailVerified) {
      const token = generatePasswordResetToken();

      user.passwordResetToken = hashPasswordResetToken(token);
      user.passwordResetExpires = getPasswordResetExpiry();

      await user.save();

      const resetUrl = process.env.PASSWORD_RESET_URL;

      if (!resetUrl) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        throw new Error("PASSWORD_RESET_URL is not configured");
      }

      const resetLink = `${resetUrl}?token=${encodeURIComponent(token)}`;

      try {
        await sendEmail(
          email,
          "Reset your password",
          `Hello ${user.name},\n\nUse this link to reset your password:\n${resetLink}\n\nThis link expires in 15 minutes. If you did not request this, you can ignore this email.`,
          `<p>Hello ${user.name},</p><p>Use the link below to reset your password:</p><p><a href="${resetLink}">Reset Password</a></p><p>This link expires in 15 minutes. If you did not request this, you can ignore this email.</p>`
        );
      } catch (emailError) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        throw emailError;
      }
    }

    res.status(200).json({
      success: true,
      message: "If a verified account exists for that email, a password reset link has been sent."
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to process the request right now"
    });
  }
};

export const resetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  const result = resetPasswordSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid input",
      errors: result.error.issues
    });
    return;
  }

  try {
    const { token, password } = result.data;
    const tokenHash = hashPasswordResetToken(token);

    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
      isEmailVerified: true
    }).select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      res.status(400).json({
        success: false,
        message: "Password reset link is invalid, expired, or already used"
      });
      return;
    }

    user.password = await hashPassword(password);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    await RefreshToken.updateMany(
      { userId: user._id, revoked: false },
      { $set: { revoked: true } }
    );

    res.status(200).json({
      success: true,
      message: "Password reset successfully. Please log in with your new password."
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to reset password right now"
    });
  }
};

export const resendVerificationEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  const result = resendVerificationSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      success: false,
      message: "Invalid input",
      errors: result.error.issues
    });
    return;
  }

  try {
    const { email } = result.data;

    const user = await User.findOne({
      email,
      isEmailVerified: false
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (user) {
      const token = generateEmailVerificationToken();

      user.emailVerificationToken = hashEmailVerificationToken(token);
      user.emailVerificationExpires = getEmailVerificationExpiry();

      await user.save();

      const verificationUrl = process.env.EMAIL_VERIFICATION_URL;

      if (!verificationUrl) {
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();
        throw new Error("EMAIL_VERIFICATION_URL is not configured");
      }

      const verificationLink =
        `${verificationUrl}?token=${encodeURIComponent(token)}`;

      try {
        await sendEmail(
          email,
          "Verify your email address",
          `Hello ${user.name},\n\nPlease verify your email address using this link:\n${verificationLink}\n\nThis link expires in 15 minutes.`,
          `<p>Hello ${user.name},</p><p>Please verify your email address using the link below:</p><p><a href="${verificationLink}">Verify Email</a></p><p>This link expires in 15 minutes.</p>`
        );
      } catch (emailError) {
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();
        throw emailError;
      }
    }

    res.status(200).json({
      success: true,
      message: "If an unverified account exists for that email, a verification link has been sent."
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to process the request right now"
    });
  }
};
