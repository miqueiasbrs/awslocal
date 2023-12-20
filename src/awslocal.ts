import fs from 'fs'
import http from 'http'
import path from 'path'

import { APIGatewayClient, GetResourcesCommand } from '@aws-sdk/client-api-gateway'
import dotenv from 'dotenv'

import { ApiGateway, SNS, SQS } from './utils/index.js'
import { AWSLambda } from './utils/lambda.js'
import logger from './logger.js'

export const defaultConfig: App.AWSLocal.Config = {
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
  port: 9000
}

export function createConfigFile(): void {
  fs.writeFileSync(
    '.awslocal.json',
    JSON.stringify(
      Object.assign({}, defaultConfig, {
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
      }),
      null,
      2
    )
  )
}

export class AWSLocal {
  private readonly config: App.AWSLocal.Config

  private readonly eventPath?: string

  constructor(options: App.Commander.Options) {
    const configFromFile = this._loadConfigFromFile(options.config)

    if (options.lambdaPath) configFromFile.lambda.path = options.lambdaPath
    if (options.lambdaHandler && defaultConfig.lambda.handler !== options.lambdaHandler)
      configFromFile.lambda.handler = options.lambdaHandler
    if (options.timeout && defaultConfig.lambda.timeout.toString() !== options.timeout)
      configFromFile.lambda.timeout = parseInt(options.timeout)
    if (options.profile && defaultConfig.aws.profile !== options.profile) configFromFile.aws.profile = options.profile
    if (options.region && defaultConfig.aws.region !== options.region) configFromFile.aws.region = options.region
    if (options.envPath && defaultConfig.lambda.env !== options.envPath) configFromFile.lambda.env = options.envPath
    if (options.port && defaultConfig.port.toString() !== options.port) {
      if (
        options.port &&
        !isNaN(parseInt(options.port)) &&
        parseInt(options.port) > 0 &&
        parseInt(options.port) < 65535
      ) {
        configFromFile.port = parseInt(options.port)
      }
    }

    dotenv.config({ path: configFromFile.lambda.env })
    process.env.AWS_REGION = configFromFile.aws.region
    process.env.AWS_PROFILE = configFromFile.aws.profile
    process.env.AWS_DEFAULT_REGION = configFromFile.aws.region

    if (configFromFile.lambda.path && !fs.existsSync(path.resolve(configFromFile.lambda.path))) {
      logger.error(`Lambda path ${configFromFile.lambda.path} not found or not exists`)
      process.exit(0)
    }

    this.config = configFromFile
    this.eventPath = options.eventPath
  }

  server(): void {
    this._serverInit()
      .then(() => {
        AWSLambda.create(this.config.lambda.path as string, this.config.lambda.handler)
          .then((lambdaFunction) => {
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
                            .invoke(Buffer.concat(body).toString(), this.config.lambda.timeout)
                            .then((data) => {
                              if (data?.errorType)
                                res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
                              else res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
                            })
                            .catch((e) => this._buildError(e))
                          break
                        case 'ANY-apigateway-invoke':
                          ApiGateway.buildInputMock(Buffer.concat(body).toString(), req, this.config.apigateway ?? {})
                            .then((mock) => {
                              if (!mock) {
                                res
                                  .writeHead(403)
                                  .end(
                                    `Endpoint ${req.url?.substring(
                                      req.url?.indexOf('apigateway-invoke') + 17
                                    )} not mapped in .awslocal.json file.`
                                  )
                              } else {
                                lambdaFunction
                                  .invoke(mock, this.config.lambda.timeout)
                                  .then((data) => {
                                    if (data?.errorType) {
                                      res
                                        .writeHead(500, { 'Content-Type': 'application/json' })
                                        .end(JSON.stringify(data))
                                    } else if (data) {
                                      res
                                        .writeHead(
                                          data.statusCode,
                                          Object.assign(data.headers ?? {}, { 'Content-Type': 'application/json' })
                                        )
                                        .end(data.body)
                                    } else res.writeHead(403).end()
                                  })
                                  .catch((e) => {
                                    res.writeHead(500, { 'Content-Type': 'application/json' }).end(this._buildError(e))
                                  })
                              }
                            })
                            .catch(this._buildError)
                          break
                        case 'POST-sns-invoke':
                          lambdaFunction
                            .invoke(SNS.buildInputMock(Buffer.concat(body).toString()), this.config.lambda.timeout)
                            .then((data) => {
                              res.writeHead(200, { 'Content-Type': 'application/json' }).end(data)
                            })
                            .catch((e) => {
                              res.writeHead(500, { 'Content-Type': 'application/json' }).end(this._buildError(e))
                            })
                          break
                        case 'POST-sqs-invoke':
                          lambdaFunction
                            .invoke(SQS.buildInputMock(Buffer.concat(body).toString()), this.config.lambda.timeout)
                            .then((data) => {
                              res.writeHead(200, { 'Content-Type': 'application/json' }).end(data)
                            })
                            .catch((e) => {
                              res.writeHead(500, { 'Content-Type': 'application/json' }).end(this._buildError(e))
                            })
                          break
                        default:
                          res.writeHead(400, { 'Content-Type': 'application/json' }).end(this._buildInvokeError())
                          break
                      }
                    } catch (e: any) {
                      res.writeHead(500, { 'Content-Type': 'application/json' }).end(this._buildError(e))
                    }
                  })
              })
              .listen(this.config.port, () => {
                logger.info(`Started server on http://localhost:${this.config.port}`)
                logger.info(`Lambda emulator \t\tPOST \t/lambda-invoke`)
                logger.info(`API Gateway emulator \tANY \t/apigateway-invoke/{your-path}`)
                logger.info(`SNS emulator \t\tPOST \t/sns-invoke`)
                logger.info(`SQS emulator \t\tPOST \t/sqs-invoke`)
              })
          })
          .catch((e) => {
            this._internalError(e)
          })
      })
      .catch((err) => logger.error(err))
  }

  local(): void {
    if (!this.eventPath || !fs.existsSync(path.resolve(this.eventPath))) {
      logger.error(`Event file '${this.eventPath}' not found`)
      process.exit(0)
    }

    AWSLambda.create(this.config.lambda.path as string, this.config.lambda.handler)
      .then((lambdaFunction) => {
        const event = JSON.parse(fs.readFileSync(path.resolve(this.eventPath as string), 'utf8'))
        lambdaFunction
          .invoke(event, this.config.lambda.timeout)
          .then(() => process.exit(0))
          .catch((e) => {
            this._internalError(e)
          })
      })
      .catch((e) => {
        this._internalError(e)
      })
  }

  private _loadConfigFromFile(configPath: string): App.AWSLocal.Config {
    configPath = path.resolve(configPath)

    if (!fs.existsSync(configPath)) {
      return defaultConfig
    }

    logger.debug(`Loading config file ${configPath}`)
    const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))

    const config: App.AWSLocal.Config = {
      port:
        rawConfig.port && !isNaN(rawConfig.port) && rawConfig.port > 0 && rawConfig.port < 65535
          ? parseInt(rawConfig.port.toString())
          : defaultConfig.port,
      lambda: {
        path: rawConfig.lambda.path || defaultConfig.lambda.path,
        handler: rawConfig.lambda.handler || defaultConfig.lambda.handler,
        timeout:
          rawConfig.lambda.timeout && !isNaN(parseInt(rawConfig.lambda.timeout.toString()))
            ? parseInt(rawConfig.lambda.timeout.toString())
            : defaultConfig.lambda.timeout,
        env: rawConfig.lambda.env || defaultConfig.lambda.env
      },
      aws: {
        region: rawConfig.aws.region || defaultConfig.aws.region,
        profile: rawConfig.aws.profile || defaultConfig.aws.profile
      },
      apigateway: {
        restApiId: rawConfig.apigateway?.restApiId,
        resources: rawConfig.apigateway?.resources
          ? rawConfig.apigateway?.resources.map((x: any) => {
              return {
                resource: x.resource,
                method: x.method,
                hasAuthorizer: x.hasAuthorizer
              }
            })
          : undefined,
        authorizer: {
          context: rawConfig.apigateway?.authorizer?.context,
          functionName: rawConfig.apigateway?.authorizer?.functionName
        }
      }
    }

    return config
  }

  private _internalError(err: any): void {
    const error = JSON.parse(this._buildError(err))
    logger.error(
      `${error.errorMessage}\n\tErrorType: ${error.errorType}\n\tStackTrace:\n\t\t${error.stackTrace
        .map((x: string) => x.concat('\n\t\t\t'))
        .join('')}`
    )
  }

  private _buildError(err: any): string {
    return JSON.stringify({
      errorMessage: err.message,
      errorType: err.constructor.name,
      stackTrace: err.stack
        .split('\n')
        .filter((f: string) => f !== err.constructor.name)
        .map((m: string) => m.replace('at ', '').trim())
    })
  }

  private _buildInvokeError(): string {
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

  private async _serverInit(): Promise<void> {
    if (this.config.apigateway?.restApiId) {
      const client = new APIGatewayClient({})

      const command = new GetResourcesCommand({ restApiId: this.config.apigateway.restApiId })
      do {
        const { items, position } = await client.send(command)
        command.input.position = position

        for (const item of items ?? []) {
          if (!this.config.apigateway.resources) this.config.apigateway.resources = []
          const path = item.path?.replaceAll('{', ':').replaceAll('}', '')

          if (!path) continue
          Object.keys(item.resourceMethods ?? {})
            .filter((f) => f !== 'OPTIONS')
            .forEach((method) => {
              const hasAuthorizer = !!item.resourceMethods?.[method]?.authorizerId
              if (method === 'ANY') {
                this.config.apigateway?.resources?.push(
                  { resource: path, method: 'GET', hasAuthorizer },
                  { resource: path, method: 'PUT', hasAuthorizer },
                  { resource: path, method: 'POST', hasAuthorizer },
                  { resource: path, method: 'PATCH', hasAuthorizer },
                  { resource: path, method: 'DELETE', hasAuthorizer }
                )
              } else this.config.apigateway?.resources?.push({ resource: path, method, hasAuthorizer })
            })
        }
      } while (command.input.position)
    }
  }
}
