import fs from 'node:fs'
import path from 'node:path'

import { Command } from 'commander'

import { DEFAULT_AWS_LOCAL_CONFIG, server } from '../core/awslocal.js'
import logger from '../core/logger.js'
import { loadConfig, options } from './commons.js'

const command = new Command('server')
  .description('Start awslocal in server mode')
  .option('-P, --port <number>', 'Server port', DEFAULT_AWS_LOCAL_CONFIG.serverPort.toString())
  .helpOption('-H, --help')
  .action(() => {
    const config = loadConfig({ ...command.opts(), ...command.parent?.opts() })
    if (!config.lambda.path) {
      logger.error(`Lambda path '${config.lambda.path}' not found`)
      process.exit(0)
    }

    config.lambda.path = path.resolve(config.lambda.path)
    if (!fs.existsSync(config.lambda.path)) {
      logger.error(`Lambda path '${config.lambda.path}' not found`)
      process.exit(0)
    }

    server(config)
  })

for (const option of options) command.addOption(option)
export default command
