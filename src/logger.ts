import { createLogger, format, transports } from 'winston'

import { appConfig } from '#configs/index.js'

export default createLogger({
  level: appConfig.logLevel,
  format: format.combine(format.colorize(), format.simple()),
  transports: [new transports.Console()]
})
