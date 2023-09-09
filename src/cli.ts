#!/usr/bin/env ts-node
import fs from 'fs'

import { AWSLocal, AWSLocalConfig } from './awslocal.js'

import { program } from 'commander'

const { name, version, description } = Object.freeze(JSON.parse(fs.readFileSync('./package.json', 'utf8')))

program
  .name(name)
  .version(version)
  .description(description)
  .option('-i, --init', 'create awslocal settings file')
  .option('-c, --config <path>', 'Path to the config file', '.awslocal.json')
  .helpOption('-H, --help')
  .action((type) => {
    if (type.init) AWSLocalConfig.createInitFile()

    const config = AWSLocalConfig.loadConfigFile(type.config)
    new AWSLocal(config).startServer()
  })
  .showHelpAfterError()
  .parse()
