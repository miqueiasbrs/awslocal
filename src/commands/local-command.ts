import { existsSync, readFileSync } from 'fs'
import path from 'path'

import { Command } from 'commander'

import { modeLocal } from '../awslocal.js'
import logger from '../utils/logger.js'

import { loadConfig, options } from './commons.js'

const command = new Command('local')
  .description('Start awslocal in local mode')
  .option('-E, --event-path <path>', 'Path to the event file json', 'test-event.json')
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

    let eventPath: string | undefined = command.opts().eventPath
    if (!eventPath) {
      logger.system.error(`Event path '${eventPath}' not found`)
      process.exit(0)
    }

    eventPath = path.resolve(eventPath)
    if (!existsSync(eventPath)) {
      logger.system.error(`Event file '${eventPath}' not found`)
      process.exit(0)
    }

    modeLocal(config, JSON.parse(readFileSync(eventPath, 'utf8')))
  })

options.forEach((option) => command.addOption(option))

export default command
