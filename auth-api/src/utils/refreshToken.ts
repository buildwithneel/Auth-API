import crypto from "crypto";

export const hashRefreshToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const getRefreshTokenExpiry = (): Date => {
  const expiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";
  const match = expiresIn.match(/^(\d+)([smhd])$/);

  if (!match) {
    throw new Error("Invalid REFRESH_TOKEN_EXPIRES_IN format");
  }

  const value = Number(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  if (!unit || multipliers[unit] === undefined) {
    throw new Error("Invalid refresh token expiry unit");
  }

  return new Date(Date.now() + value * multipliers[unit]);
};
