#!/usr/bin/env tsx

import { program } from 'commander'

import { description, name, version } from '../package.json'

import initCommand from './cmd/init.js'
import localCommand from './cmd/local.js'
import serverCommand from './cmd/server.js'

program
  .name(name.replace('@capybaracode/', ''))
  .version(version)
  .description(description)
  .addCommand(initCommand)
  .addCommand(serverCommand)
  .addCommand(localCommand)
  .option('-c, --config <path>', 'Path to the config file', '.awslocal.json')
  .helpOption('-H, --help')
  .showHelpAfterError()
  .parse()
