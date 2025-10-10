import { env } from "@/env";
import { Redis } from "@upstash/redis";

let redisInstance: Redis | null = null;

function getRedis(): Redis {
  if (!redisInstance) {
    if (!env.UPSTASH_REDIS_URL || !env.UPSTASH_REDIS_TOKEN) {
      throw new Error("Redis configuration is missing");
    }
    redisInstance = new Redis({
      url: env.UPSTASH_REDIS_URL,
      token: env.UPSTASH_REDIS_TOKEN,
    });
  }
  return redisInstance;
}

export const redis = new Proxy({} as Redis, {
  get: (target, prop) => {
    const redisClient = getRedis();
    const value = redisClient[prop as keyof Redis];
    if (typeof value === "function") {
      return value.bind(redisClient);
    }
    return value;
  },
});

export async function expire(key: string, seconds: number) {
  return getRedis().expire(key, seconds);
}
