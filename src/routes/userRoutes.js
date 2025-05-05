const express = require("express");
const router = express.Router();
const {
    registerUser,
    loginUser,
    getUserProfile,
    updateUserProfile,
    deleteUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUserById,
    getUserStats,
} = require("../controllers/userController");
const {
    extractUserFromToken,
    validateServiceToken,
    blockExternalRequests,
    admin,
} = require("../middleware/authMiddleware");
const logger = require("../config/logger");

// Log all incoming requests to this router
router.use((req, res, next) => {
    logger.info("Route accessed", {
        method: req.method,
        path: req.path,
        requestId: req.requestId,
    });
    next();
});

// Error handler for JSON parsing errors
router.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        logger.error("JSON parsing error", {
            error: err.message,
            requestId: req.requestId,
        });
        return res.status(400).json({
            message: "Invalid JSON in request body",
            error: err.message,
        });
    }
    next(err);
});

// Public routes - These should not require any token
router.post("/register", registerUser);
router.post("/login", loginUser);

// Apply service token validation and user extraction for protected routes
router.use(validateServiceToken);

// Protected Internal Routes
router.get("/internal/:id", getUserById);

router.use(extractUserFromToken);

// Protected user routes
router.get("/profile", getUserProfile);
router.put("/profile", updateUserProfile);
router.delete("/profile", deleteUser);

// Admin routes
router.get("/", admin, getAllUsers);
router.get("/admin/stats", admin, getUserStats);
router.get("/:id", admin, getUserById);
router.put("/:id", admin, updateUser);
router.delete("/:id", admin, deleteUserById);

module.exports = router;
