const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const connectDB = require("./config/database");
const logger = require("./config/logger");

// Generate a service ID for this instance
const serviceId = Math.random().toString(36).substring(2, 10);

// Load environment variables
dotenv.config();
logger.info("User Service starting up", {
    port: process.env.PORT,
    env: process.env.NODE_ENV,
    db: process.env.MONGODB_URI ? "Connected" : "Not configured",
});

// Connect to MongoDB
connectDB();

// Initialize Express
const app = express();

// Middleware
app.use(helmet());
app.use(
    cors({
        origin: "*",
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        preflightContinue: false,
        optionsSuccessStatus: 204,
        credentials: true,
    })
);

// Centralized request logger
app.use((req, res, next) => {
    const requestId = Math.random().toString(36).substring(2, 10);
    const startTime = Date.now();

    // Attach requestId to request object for consistent logging
    req.requestId = requestId;

    logger.http(`${req.method} ${req.url}`, {
        requestId,
        ip: req.ip,
        contentType: req.headers["content-type"],
        contentLength: req.headers["content-length"],
        authorization: req.headers.authorization ? "Present" : "None",
        serviceToken: req.headers["x-service-token"] ? "Present" : "None",
    });

    // Track response
    const originalSend = res.send;
    res.send = function (body) {
        const duration = Date.now() - startTime;
        logger.http(`Response: ${res.statusCode} (${duration}ms)`, {
            requestId,
        });
        return originalSend.call(this, body);
    };

    next();
});

// Custom body parser for authentication routes
app.use((req, res, next) => {
    if (
        req.method === "POST" &&
        (req.path.includes("/login") || req.path.includes("/register"))
    ) {
        let bodyData = "";
        req.on("data", (chunk) => {
            bodyData += chunk.toString();
        });

        req.on("end", () => {
            try {
                if (bodyData) {
                    req.body = JSON.parse(bodyData);
                    logger.debug("Parsed body successfully", {
                        requestId: req.requestId,
                    });
                }
                next();
            } catch (error) {
                logger.error("Error parsing body", {
                    requestId: req.requestId,
                    error: error.message,
                });
                res.status(400).json({ message: "Invalid JSON" });
            }
        });

        req.on("error", (err) => {
            logger.error("Request error", {
                requestId: req.requestId,
                error: err.message,
            });
            res.status(500).json({ message: "Error processing request" });
        });
    } else {
        // Use standard body parsers for other routes
        next();
    }
});

// Standard parsers for non-auth routes
app.use(
    express.json({
        limit: "10mb",
        verify: (req, res, buf, encoding) => {
            if (buf && buf.length) {
                req.rawBody = buf.toString(encoding || "utf8");
            }
        },
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb",
    })
);

// Routes
app.use("/api/users", require("./routes/userRoutes"));

// Health check route
app.get("/health", (req, res) => {
    logger.info("Health check requested", { requestId: req.requestId });
    res.status(200).json({ status: "ok", service: "user-service" });
});

app.get("/api/health", (req, res) => {
    logger.info("API health check requested", { requestId: req.requestId });
    res.status(200).json({ status: "ok", service: "user-service" });
});

// 404 handler
app.use((req, res, next) => {
    logger.warn(`404 Not Found: ${req.method} ${req.url}`, {
        requestId: req.requestId,
    });
    res.status(404).json({
        message: `Route not found: ${req.method} ${req.url}`,
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error("Error processing request", {
        requestId: req.requestId,
        path: `${req.method} ${req.url}`,
        error: err.message,
        name: err.name,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });

    if (err.name === "ValidationError") {
        return res.status(400).json({ message: err.message });
    }

    if (err.name === "UnauthorizedError") {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (err.name === "BadRequestError") {
        return res.status(400).json({ message: "Bad Request: " + err.message });
    }

    res.status(500).json({
        message: "Internal server error",
        error: err.message,
    });
});

// Graceful shutdown
process.on("SIGTERM", () => {
    logger.info("SIGTERM signal received: closing HTTP server", { serviceId });
    server.close(() => {
        logger.info("HTTP server closed", { serviceId });
        process.exit(0);
    });
});

const validateEnvironmentVariables = () => {
    const requiredVars = [
        "PORT",
        "MONGODB_URI",
        "JWT_SECRET",
        "SERVICE_SECRET",
    ];

    requiredVars.forEach((varName) => {
        if (!process.env[varName]) {
            logger.error(`Environment variable ${varName} is not set.`);
        }
    });
};

const startServer = async () => {
    try {
        await connectDB();
        logger.info("Connected to MongoDB");

        validateEnvironmentVariables();

        // Start server
        const PORT = process.env.PORT;
        const server = app.listen(PORT, () => {
            logger.info(`User service running on port ${PORT}`, { serviceId });
        });

        // Handle server timeouts
        server.timeout = 120000; // 120 seconds
        server.keepAliveTimeout = 125000;
        server.headersTimeout = 130000;
    } catch (error) {
        logger.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
