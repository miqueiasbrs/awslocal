import { program } from 'commander'

import initCommand from './cmd/init.js'
import localCommand from './cmd/local.js'
import serverCommand from './cmd/server.js'

import { appConfig } from './configs/index.js'

program
  .name(appConfig.name)
  .version(appConfig.version)
  .description(appConfig.description)
  .addCommand(initCommand)
  .addCommand(localCommand)
  .addCommand(serverCommand)
  .option('-c, --config <path>', 'Path to the config file', '.awslocal.json')
  .helpOption('-H, --help')
  .showHelpAfterError()
  .parse()
