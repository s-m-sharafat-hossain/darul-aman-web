require('dotenv').config();
const app = require('./app');
const prisma = require('./config/db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await prisma.$connect();
    logger.info('[db] Connected to PostgreSQL via Prisma.');

    const server = app.listen(PORT, () => {
      logger.info(`[server] Darul Aman Academy Portal API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });

    // Graceful shutdown — let in-flight requests finish, close DB pool.
    const shutdown = async (signal) => {
      logger.info(`[server] Received ${signal}, shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
      // Force-exit if graceful shutdown hangs.
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('[server] Failed to start:', err);
    process.exit(1);
  }
}

start();
