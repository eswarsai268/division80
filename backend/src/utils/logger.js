"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const env_1 = require("../config/env");
exports.logger = (0, pino_1.default)({
    level: env_1.env.LOG_LEVEL,
    redact: ["req.headers.cookie", "req.headers.authorization", "res.headers['set-cookie']",
        "*.password", "*.password_hash", "*.refreshToken", "*.voter_id"],
});
