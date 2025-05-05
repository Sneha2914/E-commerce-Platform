const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const logger = require("../config/logger");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Hash password before saving
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        logger.info("Password hashed successfully", { userId: this._id });
        next();
    } catch (error) {
        logger.error("Password hashing error:", {
            error: error.message,
            userId: this._id,
        });
        next(error);
    }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (password) {
    try {
        const isMatch = await bcrypt.compare(password, this.password);
        logger.info("Password comparison completed", {
            userId: this._id,
            isMatch,
        });
        return isMatch;
    } catch (error) {
        logger.error("Password comparison error:", {
            error: error.message,
            userId: this._id,
        });
        throw error;
    }
};

const User = mongoose.model("User", userSchema);
module.exports = User;
