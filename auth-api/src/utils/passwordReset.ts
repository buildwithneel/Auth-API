import crypto from "crypto";

export const generatePasswordResetToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

export const hashPasswordResetToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const getPasswordResetExpiry = (): Date => {
  return new Date(Date.now() + 15 * 60 * 1000);
};
