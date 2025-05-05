const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const User = require("../models/User");
const logger = require("../config/logger");

describe("User API", () => {
    beforeAll(async () => {
        try {
            await User.deleteMany({});
            logger.info("Test database cleared");
        } catch (error) {
            logger.error("Error clearing test database:", {
                error: error.message,
            });
            throw error;
        }
    });

    afterAll(async () => {
        try {
            await mongoose.connection.close();
            logger.info("Test database connection closed");
        } catch (error) {
            logger.error("Error closing test database connection:", {
                error: error.message,
            });
            throw error;
        }
    });

    describe("POST /api/users/register", () => {
        it("should register a new user", async () => {
            const userData = {
                username: "testuser",
                email: "test@example.com",
                password: "password123",
            };

            const res = await request(app)
                .post("/api/users/register")
                .send(userData);

            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty("id");
            expect(res.body.username).toEqual(userData.username);
            expect(res.body.email).toEqual(userData.email);
        });

        it("should not register a user with existing email", async () => {
            const userData = {
                username: "testuser2",
                email: "test@example.com",
                password: "password123",
            };

            const res = await request(app)
                .post("/api/users/register")
                .send(userData);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty("message");
        });
    });

    describe("POST /api/users/login", () => {
        it("should login an existing user", async () => {
            const loginData = {
                email: "test@example.com",
                password: "password123",
            };

            const res = await request(app)
                .post("/api/users/login")
                .send(loginData);

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty("token");
            expect(res.body.user.email).toEqual(loginData.email);
        });

        it("should not login with invalid credentials", async () => {
            const loginData = {
                email: "test@example.com",
                password: "wrongpassword",
            };

            const res = await request(app)
                .post("/api/users/login")
                .send(loginData);

            expect(res.statusCode).toEqual(401);
            expect(res.body).toHaveProperty("message");
        });
    });
});
