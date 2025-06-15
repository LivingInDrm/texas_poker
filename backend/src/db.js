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
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = exports.pgClient = exports.connectDatabases = void 0;
const pg_1 = require("pg");
const redis_1 = require("redis");
const pgClient = new pg_1.Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'texas_poker',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
});
exports.pgClient = pgClient;
const redisClient = (0, redis_1.createClient)({
    url: process.env.REDIS_URL,
});
exports.redisClient = redisClient;
const connectDatabases = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield pgClient.connect();
        console.log('✅ PostgreSQL connected');
        yield redisClient.connect();
        console.log('✅ Redis connected');
        return { pgClient, redisClient };
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
});
exports.connectDatabases = connectDatabases;
