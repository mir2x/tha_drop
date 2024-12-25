import bcrypt from "bcrypt";
import to from "await-to-ts";
import mongoose from "mongoose";
import createError from "http-errors";
import { StatusCodes } from "http-status-codes";
import { generateToken } from "@utils/jwt";
import { Request, Response, NextFunction } from "express";
import Auth from "@models/authModel";
import User from "@models/userModel";
import { Role } from "@shared/enum";
import sendEmail from "@utils/sendEmail";
import generateOTP from "@utils/generateOTP";

const register = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { name, email, phoneNumber, role, password, confirmPassword } = req.body;
    const { licensePhoto } = (req as any).files;
    let error, auth;
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationOTP = generateOTP();
    const verificationOTPExpiredAt = new Date(Date.now() + 60 * 1000);

    const session = await mongoose.startSession();

    [error, auth] = await to(Auth.findOne({ email }));
    if (error) return next(error);
    if (auth) return next(createError(StatusCodes.CONFLICT, "Email already exists"));

    try {
        session.startTransaction();
        [error, auth] = await to(
            Auth.create({
                email,
                password: hashedPassword,
                role,
                verificationOTP,
                verificationOTPExpiredAt,
                isVerified: false,
                isBlocked: false,
                isApproved: role === Role.GUEST,
            })
        );
        if (error) throw error;

        [error] = await to(
            User.create({
                auth: auth._id,
                name,
                phoneNumber,
                licensePhoto: licensePhoto[0].path,
            })
        );
        if (error) throw error;

        await sendEmail(email, verificationOTP);
        await session.commitTransaction();
        await session.endSession();

        return res.status(StatusCodes.CREATED).json({
            success: true,
            message: "Success",
            data: auth.isVerified,
        });
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
            await session.endSession();
        }
        return next(error);
    } finally {
        await session.endSession();
    }
};

const activate = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { email, verificationOTP } = req.body;
    const [error, auth] = await to(Auth.findOne({ email }).select("-password"));
    if (error) return next(error);
    if (!auth) return next(createError(StatusCodes.NOT_FOUND, "Account Not found"));

    if (auth.verificationOTP === "" || auth.verificationOTPExpiredAt === null)
        return next(createError(StatusCodes.UNAUTHORIZED, "Verification OTP has expired"));
    if (verificationOTP !== auth.verificationOTP) return next(createError(StatusCodes.UNAUTHORIZED, "Wrong OTP"));

    auth.verificationOTP = "";
    auth.verificationOTPExpiredAt = null;
    auth.isVerified = true;
    await auth.save();

    const accessSecret = process.env.JWT_ACCESS_SECRET;
    if (!accessSecret) return next(createError(StatusCodes.INTERNAL_SERVER_ERROR, "JWT secret is not defined."));
    const accessToken = generateToken(auth._id!.toString(), accessSecret, "96h");

    const user = await User.findOne({ auth: auth._id });
    return res.status(StatusCodes.OK).json({ success: true, message: "Success", data: { accessToken, auth, user } });
};

const login = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { email, password } = req.body;
    const [error, auth] = await to(Auth.findOne({ email }));
    if (error) return next(error);
    if (!auth) return next(createError(StatusCodes.NOT_FOUND, "No account found with the given email"));

    const isPasswordValid = await bcrypt.compare(password, auth.password);
    if (!isPasswordValid) return next(createError(StatusCodes.UNAUTHORIZED, "Wrong password"));
    if (!auth.isVerified) return next(createError(StatusCodes.UNAUTHORIZED, "Verify your email first"));
    if (auth.isBlocked)
        return next(createError(StatusCodes.FORBIDDEN, "Your account had been blocked. Contact Administrator"));

    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!accessSecret || !refreshSecret)
        return next(createError(StatusCodes.INTERNAL_SERVER_ERROR, "JWT secret is not defined."));

    const accessToken = generateToken(auth._id!.toString(), accessSecret, "96h");
    const refreshToken = generateToken(auth._id!.toString(), refreshSecret, "96h");

    const user = await User.findOne({ auth: auth._id });
    return res.status(StatusCodes.OK).json({
        success: true,
        message: "Success",
        data: { accessToken, refreshToken, auth, user },
    });
};

const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { email } = req.body;
    const [error, auth] = await to(Auth.findOne({ email }));
    if (error) return next(error);
    if (!auth) return next(createError(StatusCodes.NOT_FOUND, "Account Not Found"));

    const recoveryOTP = generateOTP();
    auth.recoveryOTP = recoveryOTP;
    auth.recoveryOTPExpiredAt = new Date(Date.now() + 60 * 1000);
    await auth.save();
    await sendEmail(email, recoveryOTP);

    return res.status(StatusCodes.OK).json({ success: true, message: "Success", data: {} });
};

const recoveryVerification = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const { email, recoveryOTP } = req.body;
    const [error, auth] = await to(Auth.findOne({ email }).select("-password"));
    if (error) return next(error);
    if (!auth) return next(createError(StatusCodes.NOT_FOUND, "Account Not found"));

    if (auth.recoveryOTP === "" || auth.recoveryOTPExpiredAt === null)
        return next(createError(StatusCodes.UNAUTHORIZED, "Verification OTP has expired"));
    if (recoveryOTP !== auth.recoveryOTP) return next(createError(StatusCodes.UNAUTHORIZED, "Wrong OTP"));

    auth.recoveryOTP = "";
    auth.recoveryOTPExpiredAt = null;
    await auth.save();

    const recoverySecret = process.env.JWT_RECOVERY_SECRET;
    if (!recoverySecret) return next(createError(StatusCodes.INTERNAL_SERVER_ERROR, "JWT secret is not defined."));
    const recoveryToken = generateToken(auth._id!.toString(), recoverySecret, "96h");

    return res.status(StatusCodes.OK).json({ success: true, message: "Success", data: recoveryToken });
};

const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const user = req.user;
    const { password, confirmPassword } = req.body;
    const [error, auth] = await to(Auth.findOne({ email: user.email }));
    if (error) return next(error);
    if (!auth) return next(createError(StatusCodes.NOT_FOUND, "Account Not Found"));
    if (password !== confirmPassword) return next(createError(StatusCodes.BAD_REQUEST, "Passwords don't match"));
    auth.password = await bcrypt.hash(password, 10);
    await auth.save();
    return res.status(StatusCodes.OK).json({ success: true, message: "Success", data: {} });
};

const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const user = req.user;
    const { password, newPassword, confirmPassword } = req.body;
    let error, auth, isMatch;
    [error, auth] = await to(Auth.findById(user.authId));
    if (error) return next(error);
    if (!auth) return next(createError(StatusCodes.NOT_FOUND, "Account Not Found"));

    [error, isMatch] = await to(bcrypt.compare(password, auth.password));
    if (error) return next(error);
    if (!isMatch) return next(createError(StatusCodes.UNAUTHORIZED, "Wrong Password"));

    auth.password = await bcrypt.hash(newPassword, 10);
    await auth.save();
    return res.status(StatusCodes.OK).json({ success: true, message: "Success", data: {} });
};

const remove = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const user = req.user;
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        await Auth.findByIdAndDelete(user.authId);
        await User.findByIdAndDelete(user.userId);
        await session.commitTransaction();
        await session.endSession();
        return res.status(StatusCodes.OK).json({ success: true, message: "Success", data: {} });
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
            await session.endSession();
        }
        return next(createError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to delete account"));
    } finally {
        await session.endSession();
    }
};

const getAccessToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const user = req.user;
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
        return next(createError(StatusCodes.INTERNAL_SERVER_ERROR, "JWT secret is not defined."));
    }
    const accessToken = generateToken(user.authId, secret, "96h");
    if (!accessToken) return next(createError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed"));
    res.status(StatusCodes.OK).json({ success: true, message: "Success", data: accessToken });
};

const AuthController = {
    register,
    activate,
    login,
    forgotPassword,
    recoveryVerification,
    resetPassword,
    changePassword,
    getAccessToken,
    remove,
};

export default AuthController;