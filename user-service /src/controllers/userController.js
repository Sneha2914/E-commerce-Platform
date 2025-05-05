const User = require("../models/User");
const { UnauthorizedError, NotFoundError } = require("../errors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const logger = require("../config/logger");

// Function to generate JWT token
const generateToken = (userId, role, username, email) => {
    return jwt.sign(
        { id: userId, isAdmin: role === "admin", username, email },
        process.env.JWT_SECRET || "fallback_secret_please_set_in_env",
        { expiresIn: "30d" }
    );
};

// Register a new user
const registerUser = async (req, res, next) => {
    try {
        logger.info("Processing user registration", {
            requestId: req.requestId,
        });

        // Validate request body
        if (!req.body) {
            logger.warn("Register attempt with empty request body", {
                requestId: req.requestId,
            });
            return res.status(400).json({ message: "Empty request body" });
        }

        const { name, email, password } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            logger.warn("Register attempt with missing fields", {
                requestId: req.requestId,
            });
            return res.status(400).json({
                message: "Name, email, and password are required",
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });

        if (existingUser) {
            logger.warn("Registration failed: Email already exists", {
                requestId: req.requestId,
            });
            return res.status(400).json({ message: "User already exists" });
        }

        // Create the user
        const user = await User.create({
            username: name,
            email: email.toLowerCase(),
            password,
        });

        if (user) {
            // Generate token
            const token = generateToken(
                user._id,
                user.role,
                user.username,
                user.email
            );
            logger.info("User created successfully", {
                requestId: req.requestId,
                userId: user._id,
            });
            const userResponse = {
                _id: user._id,
                name: user.username,
                email: user.email,
                isAdmin: user.role === "admin",
            };
            res.status(201).json({
                token,
                user: userResponse,
            });
        } else {
            logger.error("Failed to create user", { requestId: req.requestId });
            res.status(400).json({ message: "Invalid user data" });
        }
    } catch (error) {
        logger.error("Error in register controller", {
            requestId: req.requestId,
            error: error.message,
        });

        // Handle validation errors from Mongoose
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map(
                (val) => val.message
            );
            return res.status(400).json({
                message: "Validation error",
                errors: messages,
            });
        }

        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                message: "Email already exists",
            });
        }

        next(error);
    }
};

// Login user
const loginUser = async (req, res, next) => {
    try {
        logger.info("Processing user login", { requestId: req.requestId });

        // Validate request body exists
        if (!req.body) {
            logger.warn("Login attempt with empty request body", {
                requestId: req.requestId,
            });
            return res.status(400).json({ message: "Empty request body" });
        }

        const { email, password } = req.body;

        // Basic validation
        if (!email || !password) {
            logger.warn("Login attempt with missing fields", {
                requestId: req.requestId,
            });
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        // Trim inputs and validate format
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail.includes("@")) {
            logger.warn("Invalid email format", { requestId: req.requestId });
            return res.status(400).json({ message: "Invalid email format" });
        }

        if (password.length < 4) {
            logger.warn("Password too short", { requestId: req.requestId });
            return res.status(400).json({
                message: "Password must be at least 4 characters",
            });
        }

        // Check if user exists
        const user = await User.findOne({ email: trimmedEmail });

        if (!user) {
            logger.warn("User not found for login attempt", {
                requestId: req.requestId,
            });
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Validate password
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            logger.warn("Invalid password", {
                requestId: req.requestId,
                userId: user._id,
            });
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Generate token
        const token = generateToken(
            user._id,
            user.role,
            user.username,
            user.email
        );
        logger.info("Login successful", {
            requestId: req.requestId,
            userId: user._id,
        });

        // Create user response without password
        const userResponse = {
            _id: user._id,
            name: user.username,
            email: user.email,
            isAdmin: user.role === "admin",
        };
        logger.info("Login successful", {
            requestId: req.requestId,
            userId: user._id,
        });

        res.status(200).json({ token, user: userResponse });
    } catch (error) {
        logger.error("Login error", {
            requestId: req.requestId,
            error: error.message,
        });
        // Return appropriate status based on error
        const status = error.name === "ValidationError" ? 400 : 500;

        // Send detailed error in development, generic in production
        const errorMessage =
            process.env.NODE_ENV === "production"
                ? "An error occurred during login"
                : error.message;

        res.status(status).json({
            message: "Login failed",
            error: errorMessage,
        });
    }
};

// Get user profile
const getUserProfile = async (req, res) => {
    try {
        logger.info("Getting user profile", {
            requestId: req.requestId,
            userId: req.user._id,
        });
        const user = await User.findById(req.user._id).select("-password");
        if (user) {
            const userResponse = {
                _id: user._id,
                name: user.username,
                email: user.email,
                isAdmin: user.role === "admin",
            };
            res.json(userResponse);
        } else {
            logger.warn("User profile not found", {
                requestId: req.requestId,
                userId: req.user._id,
            });
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        logger.error("Error getting user profile", {
            requestId: req.requestId,
            error: error.message,
        });
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Update user profile
const updateUserProfile = async (req, res) => {
    try {
        logger.info("Updating user profile", {
            requestId: req.requestId,
            userId: req.user._id,
        });
        const user = await User.findById(req.user._id);

        if (!user) {
            logger.warn("User not found for profile update", {
                requestId: req.requestId,
                userId: req.user._id,
            });
            return res.status(404).json({ message: "User not found" });
        }

        user.name = req.body.name || user.name;

        if (req.body.email) {
            // Check if new email is already taken by another user
            const emailExists = await User.findOne({
                email: req.body.email.toLowerCase(),
                _id: { $ne: req.user._id },
            });

            if (emailExists) {
                logger.warn("Email already in use", {
                    requestId: req.requestId,
                    email: req.body.email,
                });
                return res
                    .status(400)
                    .json({ message: "Email already in use" });
            }

            user.email = req.body.email.toLowerCase();
        }

        if (req.body.password) {
            user.password = req.body.password;
        }

        const updatedUser = await user.save();
        logger.info("User profile updated", {
            requestId: req.requestId,
            userId: updatedUser._id,
        });

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            isAdmin: updatedUser.isAdmin,
        });
    } catch (error) {
        logger.error("Error updating user profile", {
            requestId: req.requestId,
            error: error.message,
        });
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
    try {
        logger.info("Getting all users", { requestId: req.requestId });
        const users = await User.find({}).select("-password");
        const userResponse = users.map((user) => ({
            _id: user._id,
            name: user.username,
            email: user.email,
            isAdmin: user.role === "admin",
        }));
        res.json(userResponse);
    } catch (error) {
        logger.error("Error getting all users", {
            requestId: req.requestId,
            error: error.message,
        });
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get user by ID (admin only)
const getUserById = async (req, res) => {
    try {
        logger.info("Getting user by ID", {
            requestId: req.requestId,
            userId: req.params.id,
        });
        const user = await User.findById(req.params.id).select("-password");
        const userResponse = {
            _id: user._id,
            name: user.username,
            email: user.email,
            isAdmin: user.role === "admin",
        };
        if (user) {
            res.json(userResponse);
        } else {
            logger.warn("User not found", {
                requestId: req.requestId,
                userId: req.params.id,
            });
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        logger.error("Error getting user by ID", {
            requestId: req.requestId,
            error: error.message,
        });
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Update user (admin only)
const updateUser = async (req, res) => {
    try {
        logger.info("Updating user", {
            requestId: req.requestId,
            userId: req.params.id,
        });
        const user = await User.findById(req.params.id);

        if (!user) {
            logger.warn("User not found for update", {
                requestId: req.requestId,
                userId: req.params.id,
            });
            return res.status(404).json({ message: "User not found" });
        }

        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        user.isAdmin =
            req.body.isAdmin !== undefined ? req.body.isAdmin : user.isAdmin;

        const updatedUser = await user.save();
        logger.info("User updated", {
            requestId: req.requestId,
            userId: updatedUser._id,
        });

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            isAdmin: updatedUser.isAdmin,
        });
    } catch (error) {
        logger.error("Error updating user", {
            requestId: req.requestId,
            error: error.message,
        });
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Delete user (by the user themselves)
const deleteUser = async (req, res) => {
    try {
        logger.info("Deleting user", {
            requestId: req.requestId,
            userId: req.user._id,
        });
        const user = await User.findById(req.user._id);

        if (!user) {
            logger.warn("User not found for deletion", {
                requestId: req.requestId,
                userId: req.user._id,
            });
            return res.status(404).json({ message: "User not found" });
        }

        await user.deleteOne();
        logger.info("User deleted", {
            requestId: req.requestId,
            userId: req.user._id,
        });
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        logger.error("Error deleting user", {
            requestId: req.requestId,
            error: error.message,
        });
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Delete user by ID (admin only)
const deleteUserById = async (req, res) => {
    try {
        logger.info("Deleting user by ID", {
            requestId: req.requestId,
            userId: req.params.id,
        });
        const user = await User.findById(req.params.id);

        if (!user) {
            logger.warn("User not found for deletion", {
                requestId: req.requestId,
                userId: req.params.id,
            });
            return res.status(404).json({ message: "User not found" });
        }

        await user.deleteOne();
        logger.info("User deleted", {
            requestId: req.requestId,
            userId: req.params.id,
        });
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        logger.error("Error deleting user by ID", {
            requestId: req.requestId,
            error: error.message,
        });
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getUserStats = async (req, res) => {
    try {
        logger.info("Getting user stats", { requestId: req.requestId });
        const [totalUsers, totalAdmins] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: "admin" }),
        ]);

        res.json({
            totalUsers,
            totalAdmins,
            totalCustomers: totalUsers - totalAdmins,
        });
    } catch (error) {
        logger.error("Error getting user stats", {
            requestId: req.requestId,
            error: error.message,
        });
        res.status(500).json({
            message: "Error fetching user stats",
            error: error.message,
        });
    }
};

module.exports = {
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
};
