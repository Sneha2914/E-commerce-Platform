const jwt = require("jsonwebtoken");
const logger = require("../config/logger");

/**
 * Generate JWT token for user authentication
 * @param {string} userId - User ID to include in token payload
 * @returns {string} JWT token
 */
const generateToken = (userId) => {
    try {
        if (!process.env.JWT_SECRET) {
            logger.warn("JWT_SECRET not set in environment variables");
            throw new Error("JWT_SECRET is required");
        }

        const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
            expiresIn: "30d",
        });

        logger.info("Token generated successfully", { userId });
        return token;
    } catch (error) {
        logger.error("Token generation error:", {
            error: error.message,
            userId,
        });
        throw error;
    }
};

module.exports = generateToken;
