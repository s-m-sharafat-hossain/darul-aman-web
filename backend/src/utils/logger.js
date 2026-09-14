const winston = require('winston');

/**
 * Central application logger. Replaces ad-hoc console.log/console.error
 * calls so that:
 *  - production logs are structured JSON (easy to ship to a log
 *    aggregator / uptime tool), while dev logs stay human-readable
 *  - log level is controlled by LOG_LEVEL instead of being baked in
 *  - nothing sensitive (passwords, tokens, secrets) should ever be passed
 *    to this logger — callers are responsible for that, same as they
 *    were with console.log
 */
const isProduction = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: isProduction
    ? winston.format.combine(winston.format.timestamp(), winston.format.json())
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${message}${metaStr}`;
        })
      ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
