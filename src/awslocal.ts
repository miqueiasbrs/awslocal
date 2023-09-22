import fs from 'fs'
import http from 'http'
import path from 'path'

import { apigatewayInvoke } from './core/apigateway.js'
import { AWSLambda, type AWSLocalConfig, type LambdaFunction } from './core/index.js'
import { snsInvoke } from './core/sns.js'
import { sqsInvoke } from './core/sqs.js'
import logger from './utils/logger.js'

export class AWSLocal {
  constructor(private readonly config: AWSLocalConfig) {}

  static init(): void {
    fs.writeFileSync(
      '.awslocal.json',
      JSON.stringify({
        lambda: {
          path: 'path/to/handler',
          handler: 'handler',
          timeout: 3,
          env: '.env'
        },
        aws: {
          region: 'us-east-1',
          profile: 'default'
        },
        port: 9000,
        apigateway: {
          restApiId: 'your-rest-api-id',
          resources: [
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
      })
    )
  }

  static load(
    configPath: string,
    lambdaPath?: string,
    lambdaHandler?: string,
    lambdaTimeout?: number,
    profile?: string,
    region?: string,
    envPath?: string,
    port?: number
  ): AWSLocal {
    let fileData: any = {}
    configPath = path.resolve(configPath)
    if (!lambdaPath && !fs.existsSync(configPath)) {
      logger.system.error(`Config file '${configPath}' not found and lambdaPath uninformed`)
      process.exit(0)
    } else if (!fs.existsSync(configPath)) logger.system.warn(`Config file '${configPath}' not found`)
    else fileData = JSON.parse(fs.readFileSync(configPath, 'utf8'))

    lambdaPath = path.resolve(lambdaPath ?? fileData.lambda?.path)
    if (!fs.existsSync(lambdaPath)) {
      logger.system.error(`Lambda path '${lambdaPath}' not found`)
      process.exit(0)
    }

    process.env.AWS_REGION = region ?? fileData.aws?.region ?? 'us-east-1'
    process.env.AWS_PROFILE = profile ?? fileData.aws?.profile ?? 'default'
    process.env.AWS_DEFAULT_REGION = region ?? fileData.aws?.region ?? 'us-east-1'

    envPath = path.resolve(envPath ?? fileData.envPath ?? '.env')
    if (fs.existsSync(envPath)) {
      const env = fs.readFileSync(envPath, 'utf8')
      env.split('\n').forEach((i) => {
        const kv: any[] = i.split('=')
        process.env[kv[0]] = kv.length > 1 ? kv[1] : undefined
      })
    } else logger.system.warn(`Not found env file: ${envPath} to load environment variables`)

    lambdaTimeout = lambdaTimeout ?? fileData.lambda?.timeout
    if (lambdaTimeout && !isNaN(lambdaTimeout)) {
      lambdaTimeout = parseInt(lambdaTimeout.toString())
    } else {
      logger.system.warn(`Invalid timeout: ${lambdaTimeout}, set default to 3`)
      lambdaTimeout = 3
    }

    port = port ?? fileData.port
    if (port && !isNaN(port) && parseInt(port.toString()) >= 1 && parseInt(port.toString()) <= 65535) {
      port = parseInt(port.toString())
    } else {
      logger.system.warn(`Invalid port: ${port}, set default to 9000`)
      port = 9000
    }

    const apigateway = fileData.apigateway
      ? {
          restApiId: fileData.apigateway.restApiId,
          routes: (fileData.apigateway.routes ?? []).map((x: any) => ({
            path: x.path,
            method: x.method,
            hasAuthorizer: x.hasAuthorizer
          })),
          authorizer: fileData.apigateway.authorizer
            ? {
                context: fileData.apigateway.authorizer.context,
                functionName: fileData.apigateway.authorizer.functionName
              }
            : undefined
        }
      : undefined

    return new AWSLocal({
      lambdaPath,
      lambdaTimeout,
      lambdaHandler: lambdaHandler ?? fileData.lambda?.handler ?? 'handler',
      port,
      apigateway
    })
  }

  server(): void {
    AWSLambda.create(this.config.lambdaPath, this.config.lambdaHandler)
      .then((lambdaFunction) => {
        this.__createServer(lambdaFunction)
      })
      .catch((e) => {
        this.__internalError(e)
      })
  }

  local(eventPath: string): void {
    eventPath = path.resolve(eventPath)
    if (!fs.existsSync(eventPath)) {
      logger.system.error(`Event file '${eventPath}' not found`)
      process.exit(0)
    }

    AWSLambda.create(this.config.lambdaPath, this.config.lambdaHandler)
      .then((lambdaFunction) => {
        const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'))
        lambdaFunction
          .invoke(event, this.config.lambdaTimeout)
          .then(() => process.exit(0))
          .catch((e) => {
            this.__internalError(e)
          })
      })
      .catch((e) => {
        this.__internalError(e)
      })
  }

  private __createServer(lambdaFunction: AWSLambda): void {
    http
      .createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
        const body: any[] = []
        req
          .on('data', (chunk) => {
            body.push(chunk)
          })
          .on('end', () => {
            try {
              const invoke = req.url
                ?.split('/')
                .map((i) => (i === 'apigateway-invoke' ? 'ANY-apigateway-invoke' : `${req.method}-${i}`))[1]

              switch (invoke) {
                case 'POST-lambda-invoke':
                  lambdaFunction
                    .invoke(Buffer.concat(body).toString(), this.config.lambdaTimeout)
                    .then((data) => {
                      if (data?.errorType)
                        res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
                      else res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
                    })
                    .catch((e) => this.__buildError(e))
                  break
                case 'ANY-apigateway-invoke':
                  apigatewayInvoke(
                    Buffer.concat(body).toString(),
                    req,
                    lambdaFunction,
                    this.config.apigateway ?? { routes: [] },
                    this.config.lambdaTimeout
                  )
                    .then((data) => {
                      if (data?.errorType) {
                        res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
                      } else if (data) {
                        res
                          .writeHead(
                            data.statusCode,
                            Object.assign(data.headers ?? {}, { 'Content-Type': 'application/json' })
                          )
                          .end(data.body)
                      } else res.writeHead(403).end()
                    })
                    .catch(this.__buildError)
                  break
                case 'POST-sns-invoke':
                  snsInvoke(Buffer.concat(body).toString(), lambdaFunction, this.config.lambdaTimeout)
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
                    .catch((e) => this.__buildError(e))
                  break
                case 'POST-sqs-invoke':
                  sqsInvoke(Buffer.concat(body).toString(), lambdaFunction, this.config.lambdaTimeout)
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
                    .catch((e) => this.__buildError(e))
                  break
                default:
                  res.writeHead(400, { 'Content-Type': 'application/json' }).end(this.__buildInvokeError())
                  break
              }
            } catch (e: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' }).end(this.__buildError(e))
            }
          })
      })
      .listen(this.config.port, () => {
        logger.system.info(`Started server on http://localhost:${this.config.port}`)
        logger.system.info(`Lambda emulator \t\tPOST \t/lambda-invoke`)
        logger.system.info(`API Gateway emulator \tANY \t/apigateway-invoke/{your-path}`)
        logger.system.info(`SNS emulator \t\tPOST \t/sns-invoke`)
        logger.system.info(`SQS emulator \t\tPOST \t/sqs-invoke`)
      })
  }

  private __buildInvokeError(): string {
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

  private __internalError(err: any): void {
    const error = JSON.parse(this.__buildError(err))
    logger.system.error(
      `${error.errorMessage}\n\tErrorType: ${error.errorType}\n\tStackTrace:\n\t\t${error.stackTrace
        .map((x: string) => x.concat('\n\t\t\t'))
        .join('')}`
    )
  }

  private __buildError(err: any): string {
    return JSON.stringify({
      errorMessage: err.message,
      errorType: err.constructor.name,
      stackTrace: err.stack
        .split('\n')
        .filter((f: string) => f !== err.constructor.name)
        .map((m: string) => m.replace('at ', '').trim())
    })
  }
}
