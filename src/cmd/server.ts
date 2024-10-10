import { Command } from 'commander'

import { DEFAULT_AWS_LOCAL_CONFIG, server } from '../core/awslocal.js'
import { loadConfig, options } from './commons.js'

const command = new Command('server')
  .description('Start awslocal in server mode')
  .option('-P, --port <number>', 'Server port', DEFAULT_AWS_LOCAL_CONFIG.serverPort.toString())
  .helpOption('-H, --help')
  .action(() => {
    const config = loadConfig({ ...command.opts(), ...command.parent?.opts() })
    server(config)
  })

for (const option of options) command.addOption(option)
export default command
