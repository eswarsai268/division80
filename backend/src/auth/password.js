"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dummyHash = exports.verifyPassword = exports.hashPassword = void 0;
const argon2_1 = __importDefault(require("argon2"));
const opts = { type: argon2_1.default.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const hashPassword = (pw) => argon2_1.default.hash(pw, opts);
exports.hashPassword = hashPassword;
const verifyPassword = (hash, pw) => argon2_1.default.verify(hash, pw).catch(() => false);
exports.verifyPassword = verifyPassword;
let dummy = null;
/** Verified against when the account doesn't exist, to equalise login timing. */
const dummyHash = () => (dummy ??= argon2_1.default.hash("not-a-real-password", opts));
exports.dummyHash = dummyHash;
