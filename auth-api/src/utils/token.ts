import jwt from "jsonwebtoken";

const getSecret = (key: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET"): string => {
  const secret = process.env[key];

  if (!secret) {
    throw new Error(`${key} is missing from environment variables`);
  }

  return secret;
};

export const generateAccessToken = (userId: string, role: "user" | "admin"): string => {
  return jwt.sign(
    { userId, role },
    getSecret("JWT_ACCESS_SECRET"),
    { expiresIn: (process.env.ACCESS_TOKEN_EXPIRES_IN || "15m") as jwt.SignOptions["expiresIn"] }
  );
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    getSecret("JWT_REFRESH_SECRET"),
    { expiresIn: (process.env.REFRESH_TOKEN_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"] }
  );
};
