import { existsSync, readFileSync } from 'fs'

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

export function loadConfig(opts: Record<string, string>): App.AWSLocalConfig {
  let configFile: any = {}
  if (existsSync(opts.config)) configFile = JSON.parse(readFileSync(opts.config, 'utf8') ?? '{}')

  // Define profile
  let profile = DEFAULT_AWS_LOCAL_CONFIG.aws.profile
  if (configFile.aws?.profile && configFile.aws?.profile !== DEFAULT_AWS_LOCAL_CONFIG.aws.profile)
    profile = configFile.aws.profile
  if (opts.profile && opts.profile !== DEFAULT_AWS_LOCAL_CONFIG.aws.profile) profile = opts.profile

  // Define region
  let region = DEFAULT_AWS_LOCAL_CONFIG.aws.region
  if (configFile.aws?.region && configFile.aws?.region !== DEFAULT_AWS_LOCAL_CONFIG.aws.region)
    region = configFile.aws.region
  if (opts.region && opts.region !== DEFAULT_AWS_LOCAL_CONFIG.aws.region) region = opts.region

  // Define port
  let serverPort = DEFAULT_AWS_LOCAL_CONFIG.serverPort
  if (configFile.serverPort && configFile.serverPort !== DEFAULT_AWS_LOCAL_CONFIG.serverPort)
    serverPort = configFile.serverPort
  if (opts.port && opts.port !== DEFAULT_AWS_LOCAL_CONFIG.serverPort.toString()) serverPort = parseInt(opts.port)

  if (
    serverPort &&
    !isNaN(serverPort) &&
    parseInt(serverPort.toString()) >= 1 &&
    parseInt(serverPort.toString()) <= 65535
  ) {
    serverPort = parseInt(serverPort.toString())
  } else {
    logger.system.warn(`Invalid port: ${serverPort}, set default to 9000`)
    serverPort = DEFAULT_AWS_LOCAL_CONFIG.serverPort
  }

  // Define lambda timeout
  let timeout = DEFAULT_AWS_LOCAL_CONFIG.lambda.timeout
  if (configFile.lambda?.timeout && configFile.lambda?.timeout !== DEFAULT_AWS_LOCAL_CONFIG.lambda.timeout)
    timeout = configFile.lambda.timeout
  if (opts.timeout && opts.timeout !== DEFAULT_AWS_LOCAL_CONFIG.lambda.timeout.toString())
    timeout = parseInt(opts.timeout)

  if (timeout && !isNaN(timeout)) timeout = parseInt(timeout.toString())
  else {
    logger.system.warn(`Invalid timeout: ${timeout}, set default to 3`)
    timeout = DEFAULT_AWS_LOCAL_CONFIG.lambda.timeout
  }

  // Define lambda env path
  let envPath = DEFAULT_AWS_LOCAL_CONFIG.lambda.envPath
  if (configFile.lambda?.envPath && configFile.lambda?.envPath !== DEFAULT_AWS_LOCAL_CONFIG.lambda.envPath)
    envPath = configFile.lambda.envPath
  if (opts.envPath && opts.envPath !== DEFAULT_AWS_LOCAL_CONFIG.lambda.envPath) envPath = opts.envPath

  // Define lambda handler
  let handler = DEFAULT_AWS_LOCAL_CONFIG.lambda.handler
  if (configFile.lambda?.handler && configFile.lambda?.handler !== DEFAULT_AWS_LOCAL_CONFIG.lambda.handler)
    handler = configFile.lambda.handler
  if (opts.lambdaHandler && opts.lambdaHandler !== DEFAULT_AWS_LOCAL_CONFIG.lambda.handler) handler = opts.lambdaHandler

  // Define lambda path
  let path
  if (configFile.lambda?.path && configFile.lambda?.path !== DEFAULT_AWS_LOCAL_CONFIG.lambda.path)
    path = configFile.lambda.path
  if (opts.lambdaPath && opts.lambdaPath !== DEFAULT_AWS_LOCAL_CONFIG.lambda.path) path = opts.lambdaPath

  const apigateway: App.APIGatewayConfig = { routes: [], authorizer: {} }
  if (configFile.apigateway?.restApiId) apigateway.restApiId = configFile.apigateway.restApiId
  if (configFile.apigateway?.routes)
    apigateway.routes = configFile.apigateway.routes.map((route: App.APIGatewayRouteConfig) => ({
      resource: route.resource,
      method: route.method,
      hasAuthorizer: route.hasAuthorizer
    }))

  if (configFile.apigateway?.authorizer) {
    apigateway.authorizer.functionName = configFile.apigateway.authorizer?.functionName
    apigateway.authorizer.context = configFile.apigateway.authorizer?.context
  }

  return { aws: { profile, region }, serverPort, lambda: { timeout, envPath, handler, path }, apigateway }
}
