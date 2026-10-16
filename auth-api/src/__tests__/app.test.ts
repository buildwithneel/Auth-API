
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("Health endpoint", () => {
  it("should return healthy status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      status: "healthy"
    });
  });
});

describe("Root endpoint", () => {
  it("should confirm the API is running", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Authentication API is running"
    });
  });
});

describe("Not found middleware", () => {
  it("should return 404 for an unknown route", async () => {
    const response = await request(app).get("/api/unknown-route");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: "Route not found: GET /api/unknown-route"
    });
  });
});


describe("Authentication middleware", () => {
  it("should reject profile requests without an access token", async () => {
    const response = await request(app).get("/api/auth/profile");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Access token is required"
    });
  });

  it("should reject an invalid access token", async () => {
    const response = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", "Bearer fake.invalid.token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid or expired access token"
    });
  });
});





describe("Registration validation", () => {
  it("should reject invalid registration data", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "",
        email: "invalid-email",
        password: "123"
      });

    expect(response.status).toBe(400);
  });

  it("should reject registration when the name is missing", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        email: "test@example.com",
        password: "StrongPass123!"
      });

    expect(response.status).toBe(400);
  });
  
describe("Login validation", () => {
  it("should reject login with invalid data", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "invalid-email",
        password: ""
      });

    expect(response.status).toBe(400);
  });
});

});


describe("Forgot password validation", () => {
  it("should reject an invalid email address", async () => {
    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({
        email: "invalid-email"
      });

    expect(response.status).toBe(400);
  });
});


describe("Reset password validation", () => {
  it("should reject invalid reset password data", async () => {
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({
        token: "",
        password: "123"
      });

    expect(response.status).toBe(400);
  });
});
