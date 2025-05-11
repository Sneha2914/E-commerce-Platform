const jwt = require("jsonwebtoken");
const { UnauthorizedError } = require("../errors");
const logger = require("../config/logger");

/**
 * Middleware to extract user info from token
 */
const extractUserFromToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = {
                _id: decoded.id,
                email: decoded.email,
                isAdmin: decoded.isAdmin,
            };
        } catch (error) {
            logger.error("Token extraction error:", { error: error.message });
        }
    }
    next();
};

/**
 * Middleware to validate service token for internal service calls
 * In development mode, it allows direct access without a service token
 */
// Validate service token for internal service calls
const validateServiceToken = (req, res, next) => {
    try {
        const authHeader = req.headers["x-service-token"];

        if (!authHeader) {
            throw new UnauthorizedError("No service token provided");
        }

        const decoded = jwt.verify(authHeader, process.env.SERVICE_SECRET);
        if (decoded.type !== "service") {
            throw new UnauthorizedError("Invalid service token");
        }

        // Attach service info to request
        req.service = decoded;
        next();
    } catch (error) {
        logger.error("Service token validation error:", error.message);
        throw new UnauthorizedError("Invalid service token");
    }
};

/**
 * Middleware to block external requests
 */
const blockExternalRequests = (req, res, next) => {
    // In development mode, allow direct access for testing
    if (process.env.NODE_ENV === "development") {
        return next();
    }

    if (!isFromApiGateway(req)) {
        logger.warn("Direct access attempt blocked");
        return res.status(403).json({ message: "Direct access not allowed" });
    }
    next();
};

/**
 * Helper function to check if request is from API Gateway
 */
const isFromApiGateway = (req) => {
    return req.headers["x-service-token"];
};

/**
 * Middleware to check if user is admin
 */
const admin = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        logger.warn("Unauthorized admin access attempt");
        res.status(403);
        throw new Error("Not authorized as admin");
    }
};

module.exports = {
    extractUserFromToken,
    validateServiceToken,
    blockExternalRequests,
    admin,
};
