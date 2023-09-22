#!/usr/bin/env ts-node
import fs from 'fs'

import { Argument, program } from 'commander'

import { AWSLocal } from './awslocal.js'

const { name, version, description } = Object.freeze(JSON.parse(fs.readFileSync('./package.json', 'utf8')))

program
  .name(name)
  .version(version)
  .description(description)
  .addArgument(new Argument('mode', 'Run awslocal mode').choices(['init', 'server', 'local']))
  .option('-i, --init', 'create awslocal settings file')
  .option('-c, --config <path>', 'Path to the config file', '.awslocal.json')
  .option('-l, --lambda-path <path>', 'Path to the lambda handler')
  .option('-h, --lambda-handler <handler>', 'Handler name')
  .option('-t, --timeout <number>', 'Timeout in seconds')
  .option('-p, --profile <profile>', 'AWS profile')
  .option('-r, --region <region>', 'AWS region')
  .option('-e, --env-path <path>', 'Path to the .env file')
  .option('-E, --event-path <path>', 'Path to the event file')
  .option('-P, --port <number>', 'Port')
  .helpOption('-H, --help')
  .action((type, options) => {
    if (type === 'init') AWSLocal.init()

    const awslocal = AWSLocal.load(
      options.config,
      options.lambdaPath,
      options.lambdaHandler,
      options.timeout,
      options.profile,
      options.region,
      options.envPath,
      options.port
    )

    if (type === 'server') awslocal.server()
    else if (type === 'local' && options.eventPath) awslocal.local(options.eventPath)
    else program.help()
  })
  .showHelpAfterError()
  .parse()
