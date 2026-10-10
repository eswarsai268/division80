"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.newRefreshToken = exports.sha256 = exports.signAccess = void 0;
exports.verifyAccess = verifyAccess;
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const signAccess = (userId, sessionId) => jsonwebtoken_1.default.sign({ sub: userId, sid: sessionId }, env_1.env.JWT_ACCESS_SECRET, {
    algorithm: "HS256", expiresIn: env_1.env.ACCESS_TOKEN_TTL_SECONDS, issuer: "samasya-medhi",
});
exports.signAccess = signAccess;
function verifyAccess(token) {
    try {
        const p = jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET, { algorithms: ["HS256"], issuer: "samasya-medhi" });
        return typeof p.sub === "string" && typeof p.sid === "string" ? { sub: p.sub, sid: p.sid } : null;
    }
    catch {
        return null;
    }
}
const sha256 = (s) => (0, crypto_1.createHash)("sha256").update(s).digest("hex");
exports.sha256 = sha256;
const newRefreshToken = () => (0, crypto_1.randomBytes)(32).toString("base64url");
exports.newRefreshToken = newRefreshToken;
