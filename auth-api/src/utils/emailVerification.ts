import crypto from "crypto";

export const generateEmailVerificationToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

export const hashEmailVerificationToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const getEmailVerificationExpiry = (): Date => {
  return new Date(Date.now() + 15 * 60 * 1000);
};
