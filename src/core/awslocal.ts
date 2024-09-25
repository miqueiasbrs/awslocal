import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

import { APIGatewayEmulator } from './emulators/apigateway.js'
import { LambdaEmulator } from './emulators/lambda.js'
import logger from './logger.js'

export const DEFAULT_AWS_LOCAL_CONFIG: AWSLocalConfig = {
  aws: {
    profile: 'default',
    region: 'us-east-1'
  },
  lambda: {
    path: 'path/to/handler',
    handler: 'handler',
    timeout: 3,
    envPath: '.env'
  },
  serverPort: 9000,
  apigateway: {
    restApiId: 'your-rest-api-id',
    routes: [
      {
        resource: 'your/path/{id}',
        method: 'GET',
        hasAuthorizer: false
      }
    ],
    authorizer: {
      context: {
        yourKey: 'your-value'
      },
      functionName: 'your-authorizer-function-name'
    }
  }
}

export function init() {
  fs.writeFileSync('.awslocal.json', JSON.stringify(DEFAULT_AWS_LOCAL_CONFIG, null, 2))
}

export function local(config: AWSLocalConfig, event: any) {
  loadEnv(config)
  LambdaEmulator.instance(config.lambda.path ?? '', config.lambda.handler)
    .then((lambdaFunction) => {
      lambdaFunction
        .invoke(event, config.lambda.timeout)
        .then(() => process.exit(0))
        .catch((e) => internalError(e))
    })
    .catch((e) => internalError(e))
}

export function server(config: AWSLocalConfig) {
  loadEnv(config)

  LambdaEmulator.instance(config.lambda.path ?? '', config.lambda.handler)
    .then((lambdaFunction) => {
      http
        .createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
          const body: any[] = []
          req
            .on('data', (chunk) => body.push(chunk))
            .on('end', () => {
              try {
                const invoke = getInvokePath(req)
                switch (invoke) {
                  case 'POST-lambda-invoke':
                    serverLambdaInvoke(lambdaFunction, Buffer.concat(body).toString(), res, config.lambda.timeout)
                    break
                  case 'ANY-apigateway-invoke':
                    serverApigatewayInvoke(
                      lambdaFunction,
                      config.apigateway,
                      Buffer.concat(body).toString(),
                      req,
                      res,
                      config.lambda.timeout
                    )
                    break
                  default:
                    res.writeHead(400, { 'Content-Type': 'application/json' }).end(buildInvokeError())
                    break
                }
              } catch (e: any) {
                res.writeHead(500, { 'Content-Type': 'application/json' }).end(buildError(e))
              }
            })
        })
        .listen(config.serverPort, () => listeningListener(config.serverPort))
    })
    .catch((e) => internalError(e))
}

function getInvokePath(req: http.IncomingMessage) {
  return req.url
    ?.split('/')
    .map((i) => (i.toLowerCase() === 'apigateway-invoke' ? 'ANY-apigateway-invoke' : `${req.method}-${i}`))[1]
}

function serverLambdaInvoke(lambdaFunction: LambdaEmulator, body: string, res: http.ServerResponse, timeout: number) {
  lambdaFunction
    .invoke(body, timeout)
    .then((data) => {
      if (data?.errorType) res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
      else res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
    })
    .catch(buildError)
}

function serverApigatewayInvoke(
  lambdaFunction: LambdaEmulator,
  config: APIGatewayEmulatorConfig,
  body: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  timeout: number
) {
  APIGatewayEmulator.instance(lambdaFunction, config)
    .then((apigateway) => {
      apigateway
        .invoke(body, req, timeout)
        .then((data) => {
          if (data) {
            res.writeHead(data.statusCode, { 'Content-Type': 'application/json', ...data.headers }).end(data.body)
          } else res.writeHead(403).end()
        })
        .catch(buildError)
    })
    .catch(internalError)
}

function listeningListener(port: number) {
  logger.info(`Started server on http://localhost:${port}`)
  logger.info('Lambda emulator \t\tPOST \t/lambda-invoke')
  logger.info('API Gateway emulator \tANY \t/apigateway-invoke/{your-path}')
  logger.info('SNS emulator \t\tPOST \t/sns-invoke')
  logger.info('SQS emulator \t\tPOST \t/sqs-invoke')
}

function loadEnv(config: AWSLocalConfig): void {
  process.env.AWS_REGION = config.aws.region
  process.env.AWS_PROFILE = config.aws.profile
  process.env.AWS_DEFAULT_REGION = config.aws.region

  config.lambda.envPath = path.resolve(config.lambda.envPath)
  if (fs.existsSync(config.lambda.envPath)) {
    const env = fs.readFileSync(config.lambda.envPath, 'utf8')
    for (const i of env.split('\n')) {
      const kv: any[] = i.split('=')
      process.env[kv[0]] = kv.length > 1 ? kv[1] : undefined
    }
  } else logger.warn(`Not found env file: ${config.lambda.envPath} to load environment variables`)
}

function internalError(err: any): void {
  const error = JSON.parse(buildError(err))
  logger.error(
    `${error.errorMessage}\n\tErrorType: ${error.errorType}\n\tStackTrace:\n\t\t${error.stackTrace
      .map((x: string) => x.concat('\n\t\t\t'))
      .join('')}`
  )
}

function buildError(err: any): string {
  return JSON.stringify({
    errorMessage: err.message,
    errorType: err.constructor.name,
    stackTrace: err.stack
      .split('\n')
      .filter((f: string) => f !== err.constructor.name)
      .map((m: string) => m.replace('at ', '').trim())
  })
}

function buildInvokeError(): string {
  return JSON.stringify({
    errorMessage: 'Invalid invoke',
    errorType: 'InvalidInvoke',
    message: 'Choose a invoke enabled path',
    invoke: [
      { path: 'lambda-invoke', method: 'POST' },
      { path: 'apigateway-invoke', method: 'ANY' },
      { path: 'sns-invoke', method: 'POST' },
      { path: 'sqs-invoke', method: 'POST' }
    ]
  })
}
