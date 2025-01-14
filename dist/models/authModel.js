"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const enum_1 = require("../shared/enum");
const authSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        required: true,
        enum: enum_1.Role,
    },
    verificationOTP: {
        type: String,
    },
    verificationOTPExpiredAt: {
        type: Date,
    },
    recoveryOTP: {
        type: String,
    },
    recoveryOTPExpiredAt: {
        type: Date,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    isBlocked: {
        type: Boolean,
        default: false,
    },
    isApproved: {
        type: Boolean,
    },
});
const Auth = (0, mongoose_1.model)("Auth", authSchema);
exports.default = Auth;
