import { existsSync } from 'fs'
import path from 'path'

import { Command } from 'commander'

import { DEFAULT_AWS_LOCAL_CONFIG } from '../awslocal.js'
import logger from '../utils/logger.js'

import { loadConfig, options } from './commons.js'

const command = new Command('server')
  .description('Start awslocal in server mode')
  .option('-P, --port <number>', 'Server port', DEFAULT_AWS_LOCAL_CONFIG.serverPort.toString())
  .helpOption('-H, --help')
  .action(() => {
    const config = loadConfig(Object.assign({}, command.opts(), command.parent?.opts()))
    if (!config.lambda.path) {
      logger.system.error(`Lambda path '${config.lambda.path}' not found`)
      process.exit(0)
    }

    config.lambda.path = path.resolve(config.lambda.path)
    if (!existsSync(config.lambda.path)) {
      logger.system.error(`Lambda path '${config.lambda.path}' not found`)
      process.exit(0)
    }
  })

options.forEach((option) => command.addOption(option))

export default command
