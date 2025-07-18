import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    lazyConnect: true,
    // Connection pool settings for performance
    family: 4,
    keepAlive: 30000,
    connectTimeout: 10000,
    commandTimeout: 5000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// Handle Redis connection events
redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (error) => {
  console.error('Redis connection error:', error);
});

redis.on('ready', () => {
  console.log('Redis ready');
});

export default redis;