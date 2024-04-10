import { existsSync, readFileSync } from 'fs'
import http from 'http'
import path from 'path'

import { apigatewayInvoke, AWSLambda, snsInvoke, sqsInvoke } from './core/index.js'
import logger from './utils/logger.js'

export const DEFAULT_AWS_LOCAL_CONFIG: App.AWSLocalConfig = {
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

function loadEnv(config: App.AWSLocalConfig): void {
  process.env.AWS_REGION = config.aws.region
  process.env.AWS_PROFILE = config.aws.profile
  process.env.AWS_DEFAULT_REGION = config.aws.region

  config.lambda.envPath = path.resolve(config.lambda.envPath)
  if (existsSync(config.lambda.envPath)) {
    const env = readFileSync(config.lambda.envPath, 'utf8')
    env.split('\n').forEach((i) => {
      const kv: any[] = i.split('=')
      process.env[kv[0]] = kv.length > 1 ? kv[1] : undefined
    })
  } else logger.system.warn(`Not found env file: ${config.lambda.envPath} to load environment variables`)
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

function internalError(err: any): void {
  const error = JSON.parse(buildError(err))
  logger.system.error(
    `${error.errorMessage}\n\tErrorType: ${error.errorType}\n\tStackTrace:\n\t\t${error.stackTrace
      .map((x: string) => x.concat('\n\t\t\t'))
      .join('')}`
  )
}

export function modeServer(config: App.AWSLocalConfig): void {
  loadEnv(config)

  AWSLambda.create(config.lambda.path ?? '', config.lambda.handler)
    .then((lambdaFunction) => {
      http
        .createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
          const body: any[] = []
          req
            .on('data', (chunk) => body.push(chunk))
            .on('end', () => {
              try {
                const invoke = req.url
                  ?.split('/')
                  .map((i) => (i === 'apigateway-invoke' ? 'ANY-apigateway-invoke' : `${req.method}-${i}`))[1]

                switch (invoke) {
                  case 'POST-lambda-invoke':
                    lambdaFunction
                      .invoke(Buffer.concat(body).toString(), config.lambda.timeout)
                      .then((data) => {
                        if (data?.errorType)
                          res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
                        else res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
                      })
                      .catch((e) => buildError(e))
                    break
                  case 'ANY-apigateway-invoke':
                    apigatewayInvoke(
                      Buffer.concat(body).toString(),
                      req,
                      lambdaFunction,
                      config.apigateway,
                      config.lambda.timeout
                    )
                      .then((data) => {
                        if (data?.errorType) {
                          res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
                        } else if (data) {
                          res
                            .writeHead(
                              data.statusCode as number,
                              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                              Object.assign(data.headers ?? {}, { 'Content-Type': 'application/json' })
                            )
                            .end(data.body)
                        } else res.writeHead(403).end()
                      })
                      .catch(buildError)
                    break
                  case 'POST-sns-invoke':
                    snsInvoke(Buffer.concat(body).toString(), lambdaFunction, config.lambda.timeout)
                      .then((data) => {
                        if (data?.errorType)
                          res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
                        else if (data?.snsError)
                          res.writeHead(400, { 'Content-Type': 'application/json' }).end(
                            JSON.stringify({
                              message: 'SNS Error: Use example below',
                              example: [
                                {
                                  subject: 'Optional subject',
                                  message: {
                                    yourProperty: 'Your data object'
                                  },
                                  messageAttributes: {
                                    yourProperty: {
                                      DataType: 'String',
                                      StringValue: 'Your data object'
                                    }
                                  }
                                }
                              ]
                            })
                          )
                        else res.writeHead(200, { 'Content-Type': 'application/json' }).end()
                      })
                      .catch((e) => buildError(e))
                    break
                  case 'POST-sqs-invoke':
                    sqsInvoke(Buffer.concat(body).toString(), lambdaFunction, config.lambda.timeout)
                      .then((data) => {
                        if (data?.errorType)
                          res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
                        else if (data?.snsError)
                          res.writeHead(400, { 'Content-Type': 'application/json' }).end(
                            JSON.stringify({
                              message: 'SNS Error: Use example below',
                              example: [
                                {
                                  subject: 'Optional subject',
                                  message: {
                                    yourProperty: 'Your data object'
                                  },
                                  messageAttributes: {
                                    yourProperty: {
                                      DataType: 'String',
                                      StringValue: 'Your data object'
                                    }
                                  }
                                }
                              ]
                            })
                          )
                        else res.writeHead(200, { 'Content-Type': 'application/json' }).end()
                      })
                      .catch((e) => buildError(e))
                    break
                  default:
                    res.writeHead(400, { 'Content-Type': 'application/json' }).end(buildInvokeError())
                    break
                }
              } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' }).end(buildError(e))
              }
            })
        })
        .listen(config.serverPort, () => {
          logger.system.info(`Started server on http://localhost:${config.serverPort}`)
          logger.system.info(`Lambda emulator \t\tPOST \t/lambda-invoke`)
          logger.system.info(`API Gateway emulator \tANY \t/apigateway-invoke/{your-path}`)
          logger.system.info(`SNS emulator \t\tPOST \t/sns-invoke`)
          logger.system.info(`SQS emulator \t\tPOST \t/sqs-invoke`)
        })
    })
    .catch((e) => {
      internalError(e)
    })
}

export function modeLocal(config: App.AWSLocalConfig, event: any): void {
  loadEnv(config)

  AWSLambda.create(config.lambda.path ?? '', config.lambda.handler)
    .then((lambdaFunction) => {
      lambdaFunction
        .invoke(event, config.lambda.timeout)
        .then(() => process.exit(0))
        .catch((e) => {
          internalError(e)
        })
    })
    .catch((e) => {
      internalError(e)
    })
}
