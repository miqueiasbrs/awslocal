#!/usr/bin/env tsx

import { program } from 'commander'

import initCommand from './commands/init-command.js'
import localCommand from './commands/local-command.js'
import serverCommand from './commands/server-command.js'
import { appConfig } from './configs/index.js'

program
  .name(appConfig.name)
  .version(appConfig.version)
  .description(appConfig.description)
  .addCommand(initCommand)
  .addCommand(serverCommand)
  .addCommand(localCommand)
  .option('-c, --config <path>', 'Path to the config file', '.awslocal.json')
  .helpOption('-H, --help')
  .showHelpAfterError()
  .parse()
