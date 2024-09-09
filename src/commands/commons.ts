import fs from 'node:fs'

import { Option } from 'commander'

import { DEFAULT_AWS_LOCAL_CONFIG } from '../awslocal.js'
import logger from '../utils/logger.js'

export const options: Option[] = [
  new Option('-t, --timeout <number>', 'Lambda function timeout in seconds').default(
    DEFAULT_AWS_LOCAL_CONFIG.lambda.timeout.toString()
  ),
  new Option('-l, --lambda-path <path>', 'Path to the lambda function'),
  new Option('-e, --env-path <path>', 'Path to the .env file').default(DEFAULT_AWS_LOCAL_CONFIG.lambda.envPath),
  new Option('-h, --lambda-handler <handler>', 'Handler name').default(DEFAULT_AWS_LOCAL_CONFIG.lambda.handler),
  new Option('-p, --profile <profile>', 'AWS profile').default(DEFAULT_AWS_LOCAL_CONFIG.aws.profile),
  new Option('-r, --region <region>', 'AWS region').default(DEFAULT_AWS_LOCAL_CONFIG.aws.region)
]

function defineProfile(awsConfigFileProfile?: any, optsAwsProfile?: any): string {
  let profile = DEFAULT_AWS_LOCAL_CONFIG.aws.profile
  if (awsConfigFileProfile && awsConfigFileProfile.toString() !== DEFAULT_AWS_LOCAL_CONFIG.aws.profile)
    profile = awsConfigFileProfile.toString()
  if (optsAwsProfile && optsAwsProfile.toString() !== DEFAULT_AWS_LOCAL_CONFIG.aws.profile)
    profile = optsAwsProfile.toString()

  return profile
}

function defineRegion(awsConfigFileRegion?: any, optsRegion?: any): string {
  let region = DEFAULT_AWS_LOCAL_CONFIG.aws.region
  if (awsConfigFileRegion && awsConfigFileRegion.toString() !== DEFAULT_AWS_LOCAL_CONFIG.aws.region)
    region = awsConfigFileRegion.toString()
  if (optsRegion && optsRegion.toString() !== DEFAULT_AWS_LOCAL_CONFIG.aws.region) region = optsRegion.toString()
  return region
}

function defineServerPort(configFileServerPort?: any, optsServerPort?: any): number {
  let serverPort = DEFAULT_AWS_LOCAL_CONFIG.serverPort

  if (
    configFileServerPort &&
    !Number.isNaN(Number.parseInt(configFileServerPort.toString())) &&
    Number.parseInt(configFileServerPort.toString()) !== DEFAULT_AWS_LOCAL_CONFIG.serverPort
  )
    serverPort = Number.parseInt(configFileServerPort.toString())

  if (
    optsServerPort &&
    !Number.isNaN(Number.parseInt(optsServerPort.toString())) &&
    Number.parseInt(optsServerPort.toString()) !== DEFAULT_AWS_LOCAL_CONFIG.serverPort
  )
    serverPort = Number.parseInt(optsServerPort.toString())

  if (serverPort < 1 && serverPort > 65535) {
    logger.system.warn(`Invalid port: ${serverPort}, set default to 9000`)
    serverPort = DEFAULT_AWS_LOCAL_CONFIG.serverPort
  }

  return serverPort
}

function defineTimeout(configFileLambdaTimeout?: any, optsLambdaTimeout?: any): number {
  let timeout = DEFAULT_AWS_LOCAL_CONFIG.lambda.timeout

  if (
    configFileLambdaTimeout &&
    !Number.isNaN(Number.parseInt(configFileLambdaTimeout.toString())) &&
    Number.parseInt(configFileLambdaTimeout.toString()) !== DEFAULT_AWS_LOCAL_CONFIG.lambda.timeout
  )
    timeout = Number.parseInt(configFileLambdaTimeout.toString())

  if (
    optsLambdaTimeout &&
    !Number.isNaN(Number.parseInt(optsLambdaTimeout.toString())) &&
    Number.parseInt(optsLambdaTimeout.toString()) !== DEFAULT_AWS_LOCAL_CONFIG.lambda.timeout
  )
    timeout = Number.parseInt(optsLambdaTimeout.toString())

  return timeout
}

function defineEnvPath(configFileLambdaEnvPath?: any, optsLambdaEnvPath?: any): string {
  let envPath = DEFAULT_AWS_LOCAL_CONFIG.lambda.envPath
  if (configFileLambdaEnvPath && configFileLambdaEnvPath.toString() !== DEFAULT_AWS_LOCAL_CONFIG.lambda.envPath)
    envPath = configFileLambdaEnvPath.toString()

  if (optsLambdaEnvPath && optsLambdaEnvPath.toString() !== DEFAULT_AWS_LOCAL_CONFIG.lambda.envPath)
    envPath = optsLambdaEnvPath.toString()
  return envPath
}

function defineLambdaHandler(configFileLambdaHandler?: any, optsLambdaHandler?: any): string {
  let handler = DEFAULT_AWS_LOCAL_CONFIG.lambda.handler
  if (configFileLambdaHandler && configFileLambdaHandler.tostring() !== DEFAULT_AWS_LOCAL_CONFIG.lambda.handler)
    handler = configFileLambdaHandler.tostring()
  if (optsLambdaHandler && optsLambdaHandler.toString() !== DEFAULT_AWS_LOCAL_CONFIG.lambda.handler)
    handler = optsLambdaHandler.toString()

  return handler
}

function defineLambdaPath(configFileLambdaPath?: any, optsLambdaPath?: any): string | undefined {
  let path = undefined
  if (configFileLambdaPath && configFileLambdaPath.tostring() !== DEFAULT_AWS_LOCAL_CONFIG.lambda.path)
    path = configFileLambdaPath.tostring()
  if (optsLambdaPath && optsLambdaPath.toString() !== DEFAULT_AWS_LOCAL_CONFIG.lambda.path)
    path = optsLambdaPath.toString()

  return path
}

function defineApiGateway(configFileApigateway?: any): App.APIGatewayConfig {
  const apigateway: App.APIGatewayConfig = { routes: [], authorizer: {} }
  if (configFileApigateway?.restApiId) apigateway.restApiId = configFileApigateway.restApiId
  if (configFileApigateway?.routes)
    apigateway.routes = configFileApigateway.routes.map((route: App.APIGatewayRouteConfig) => ({
      resource: route.resource,
      method: route.method,
      hasAuthorizer: route.hasAuthorizer
    }))

  if (configFileApigateway?.authorizer) {
    apigateway.authorizer.functionName = configFileApigateway.authorizer?.functionName
    apigateway.authorizer.context = configFileApigateway.authorizer?.context
  }

  return apigateway
}

export function loadConfig(opts: Record<string, string>): App.AWSLocalConfig {
  let configFile: any = {}
  if (fs.existsSync(opts.config)) configFile = JSON.parse(fs.readFileSync(opts.config, 'utf8') ?? '{}')

  return {
    aws: {
      profile: defineProfile(configFile?.aws?.profile, opts?.profile),
      region: defineRegion(configFile?.aws?.region, opts?.region)
    },
    serverPort: defineServerPort(configFile?.serverPort, opts?.port),
    lambda: {
      timeout: defineTimeout(configFile?.lambda?.timeout, opts?.timeout),
      envPath: defineEnvPath(configFile?.lambda?.envPath, opts?.envPath),
      handler: defineLambdaHandler(configFile?.lambda?.handler, opts?.lambdaHandler),
      path: defineLambdaPath(configFile?.lambda?.path, opts?.lambdaPath)
    },
    apigateway: defineApiGateway(configFile?.apigateway)
  }
}
