#!/usr/bin/env ts-node
import { program } from 'commander'

import { createAWSLocal, createAWSLocalConfig, defaultConfig } from '#awslocal.js'
import { appConfig } from '#configs/index.js'
import logger from '#logger.js'

program
  .name(appConfig.name)
  .version(appConfig.version)
  .description(appConfig.description)
  .argument('[init]', 'Create awslocal settings file')
  .argument('[server]', 'Run server mode')
  .option('-c, --config <path>', 'Path to the config file', '.awslocal.json')
  .option('-l, --lambda-path <path>', 'Path to the lambda handler')
  .option('-h, --lambda-handler <handler>', 'Handler name', defaultConfig.lambda.handler)
  .option('-t, --timeout <number>', 'Timeout in seconds', defaultConfig.lambda.timeout.toString())
  .option('-p, --profile <profile>', 'AWS profile', defaultConfig.aws.profile)
  .option('-r, --region <region>', 'AWS region', defaultConfig.aws.region)
  .option('-e, --env-path <path>', 'Path to the .env file', defaultConfig.lambda.env)
  .option('-E, --event-path <path>', 'Path to the event file', 'test-event.json')
  .option('-P, --port <number>', 'Server Port', defaultConfig.port.toString())
  .option('--verbose', 'Enable verbose logging')
  .helpOption('-H, --help')
  .action((type, _, options) => {
    if (!['init', 'server', undefined].includes(type)) {
      program.help()
    }

    if (type === 'init') {
      createAWSLocalConfig()
      return
    }

    logger.level = options.verbose ? 'debug' : 'info'
    const awslocal = createAWSLocal(options)

    if (type === 'server') awslocal.server()
    else awslocal.local(options.eventPath)
  })
  .showHelpAfterError()
  .parse()
