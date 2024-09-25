import fs from 'node:fs'
import path from 'node:path'

import { Command } from 'commander'

import { local } from '../core/awslocal.js'
import logger from '../core/logger.js'
import { loadConfig, options } from './commons.js'

const command = new Command('local')
  .description('Start awslocal in local mode')
  .option('-E, --event-path <path>', 'Path to the event file json', 'test-event.json')
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

    let eventPath: string | undefined = command.opts().eventPath
    if (!eventPath) {
      logger.error(`Event path '${eventPath}' not found`)
      process.exit(0)
    }

    eventPath = path.resolve(eventPath)
    if (!fs.existsSync(eventPath)) {
      logger.error(`Event file '${eventPath}' not found`)
      process.exit(0)
    }

    local(config, JSON.parse(fs.readFileSync(eventPath, 'utf8')))
  })

for (const option of options) command.addOption(option)
export default command
