"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHOSTOrDJ = exports.isGUEST = exports.isAdmin = exports.recoveryAuthorize = exports.refreshAuthorize = exports.authorize = exports.getUserInfo = void 0;
const await_to_ts_1 = __importDefault(require("await-to-ts"));
require("dotenv/config");
const http_errors_1 = __importDefault(require("http-errors"));
const authModel_1 = __importDefault(require("../models/authModel"));
const userModel_1 = __importDefault(require("../models/userModel"));
const enum_1 = require("../shared/enum");
const jwt_1 = require("../utils/jwt");
const http_status_codes_1 = require("http-status-codes");
const getUserInfo = async (authId) => {
    let error, auth, user, data;
    [error, auth] = await (0, await_to_ts_1.default)(authModel_1.default.findById(authId).select("email role isVerified isBlocked"));
    if (error || !auth)
        return null;
    [error, user] = await (0, await_to_ts_1.default)(userModel_1.default.findOne({ auth: authId }));
    if (error || !user)
        return null;
    data = {
        authId: auth._id.toString(),
        email: auth.email,
        role: auth.role,
        isVerified: auth.isVerified,
        isBlocked: auth.isBlocked,
        isApproved: auth.isApproved,
        userId: user._id.toString(),
        name: user.name,
    };
    return data;
};
exports.getUserInfo = getUserInfo;
const authorizeToken = (secret, errorMessage) => {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer")) {
            return next((0, http_errors_1.default)(http_status_codes_1.StatusCodes.UNAUTHORIZED, "Not Authorized"));
        }
        const token = authHeader.split(" ")[1];
        if (!secret) {
            return next((0, http_errors_1.default)(http_status_codes_1.StatusCodes.INTERNAL_SERVER_ERROR, "JWT secret is not defined."));
        }
        const [error, decoded] = (0, jwt_1.decodeToken)(token, secret);
        if (error)
            return next(error);
        if (!decoded)
            return next((0, http_errors_1.default)(http_status_codes_1.StatusCodes.UNAUTHORIZED, errorMessage));
        const data = await (0, exports.getUserInfo)(decoded.id);
        if (!data)
            return next((0, http_errors_1.default)(http_status_codes_1.StatusCodes.NOT_FOUND, "Account Not Found"));
        if (data.isBlocked)
            return next((0, http_errors_1.default)(http_status_codes_1.StatusCodes.FORBIDDEN, "You are blocked"));
        req.user = data;
        return next();
    };
};
const hasAccess = (roles) => {
    return (req, res, next) => {
        const user = req.user;
        console.log(user);
        if (roles.includes(user.role))
            return next();
        return next((0, http_errors_1.default)(403, "Access Denied."));
    };
};
exports.authorize = authorizeToken(process.env.JWT_ACCESS_SECRET, "Invalid Access Token");
exports.refreshAuthorize = authorizeToken(process.env.JWT_REFRESH_SECRET, "Invalid Refresh Token");
exports.recoveryAuthorize = authorizeToken(process.env.JWT_RECOVERY_SECRET, "Invalid Recovery Token");
exports.isAdmin = hasAccess([enum_1.Role.ADMIN]);
exports.isGUEST = hasAccess([enum_1.Role.GUEST]);
exports.isHOSTOrDJ = hasAccess([enum_1.Role.HOST, enum_1.Role.DJ]);
