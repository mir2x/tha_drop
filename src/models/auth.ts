import { Document, Schema, model } from "mongoose";
import User from "@models/user";

export type AuthDocument = Document & {
  email: string;
  password: string;
  confirmPassword?: string;
  role: "GUEST" | "HOST" | "DJ" | "BARTENDER" | "BOTTLEGIRL";
  verificationOTP: string;
  verificationOTPExpire: Date | null;
  isVerified: boolean;
  isBlocked: boolean;
};

const authSchema = new Schema<AuthDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["GUEST", "HOST", "DJ", "BARTENDER", "BOTTLEGIRL"],
    },
    verificationOTP: {
      type: String,
      required: false,
    },
    verificationOTPExpire: {
      type: Date,
      required: false,
    },
    isVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true }
);

authSchema.pre("findOneAndDelete", async function (next) {
  const auth = await this.model.findOne(this.getQuery());
  if (auth) {
    await User.deleteOne({ authId: auth._id });
  }
  next();
});

const Auth = model<AuthDocument>("Auth", authSchema);
export default Auth;