const Sentry = require('winston-sentry')
const winston = require('winston')

winston.emitErrs = true

const transports = [
  new winston.transports.Console({
    level: 'info',
    humanReadableUnhandledException: true,
    handleExceptions: true,
    prettyPrint: true,
    colorize: true
  })
]

if (process.env.NODE_ENV === 'production') {
  transports.push(
    new Sentry({
      level: 'warn',
      dsn: process.env.SENTRY_URL,
      tags: { key: 'value' },
      extra: { key: 'value' }
    })
  )
}

const logger = new winston.Logger({ transports, exitOnError: false })

logger.stream = {
  write: (message, _encoding) => logger.info(message)
}

module.exports = logger
