"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 健康检查脚本
const db_1 = require("./db");
const prisma_1 = __importDefault(require("./prisma"));
function healthCheck() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // 检查数据库连接
            yield prisma_1.default.$queryRaw `SELECT 1`;
            // 检查Redis连接
            yield db_1.redisClient.ping();
            console.log('Health check passed');
            process.exit(0);
        }
        catch (error) {
            console.error('Health check failed:', error);
            process.exit(1);
        }
    });
}
healthCheck();
