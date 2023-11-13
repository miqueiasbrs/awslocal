import fs from 'fs'
import http from 'http'
import path from 'path'

import { APIGatewayClient, GetResourcesCommand } from '@aws-sdk/client-api-gateway'
import dotenv from 'dotenv'

import logger from '#logger.js'
import { ApiGateway, AWSLambda, SNS, SQS } from '#utils/index.js'

export const defaultConfig: App.AWSLocal.Config = {
  port: 9000,
  lambda: {
    path: 'path/to/handler',
    handler: 'handler',
    timeout: 3,
    env: '.env'
  },
  aws: {
    region: 'us-east-1',
    profile: 'default'
  }
}

export function createAWSLocal(options: App.Commander.Options): AWSLocal {
  const configPath = path.resolve(options.config)

  let config: App.AWSLocal.Config = JSON.parse(JSON.stringify(defaultConfig))
  if (fs.existsSync(configPath)) {
    logger.debug(`Loading config file ${configPath}`)
    const json = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    config = loadConfigFile(config, json)
  }

  if (options.lambdaPath) config.lambda.path = options.lambdaPath
  if (options.lambdaHandler && options.lambdaHandler !== defaultConfig.lambda.handler)
    config.lambda.handler = options.lambdaHandler
  if (options.timeout && options.timeout !== defaultConfig.lambda.timeout.toString())
    config.lambda.timeout = parseInt(options.timeout)
  if (options.profile && options.profile !== defaultConfig.aws.profile) config.aws.profile = options.profile
  if (options.region && options.region !== defaultConfig.aws.region) config.aws.region = options.region
  if (options.envPath && options.envPath !== defaultConfig.lambda.env) config.lambda.env = options.envPath
  if (options.port && options.port !== defaultConfig.port.toString()) config.port = parseInt(options.port)

  return new AWSLocal(config)
}

export function createAWSLocalConfig(): void {
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

function loadConfigFile(config: App.AWSLocal.Config, json: any): App.AWSLocal.Config {
  if (json.port && !isNaN(json.port) && json.port > 0 && json.port < 65535) config.port = parseInt(json.port.toString())

  if (json.lambda) {
    if (json.lambda.path) config.lambda.path = json.lambda.path
    if (json.lambda.handler) config.lambda.handler = json.lambda.handler
    if (json.lambda.timeout && !isNaN(json.timeout)) config.lambda.timeout = parseInt(json.lambda.timeout.toString())
    if (json.lambda.env) config.lambda.env = json.lambda.env
  }

  if (json.aws) {
    if (json.aws.region) config.aws.region = json.aws.region
    if (json.aws.profile) config.aws.profile = json.aws.profile
  }

  if (json.apigateway) {
    if (!config.apigateway) config.apigateway = {}

    if (json.apigateway.restApiId) config.apigateway.restApiId = json.apigateway.restApiId
    if (json.apigateway.resources && Array.isArray(json.apigateway.resources)) {
      config.apigateway.resources = json.apigateway.resources.map((route: App.AWSLocal.APIGatewayRoute) => {
        return {
          resource: route.resource,
          method: route.method,
          hasAuthorizer: route.hasAuthorizer
        }
      })
    }
    if (json.apigateway.authorizer) {
      if (!config.apigateway.authorizer) config.apigateway.authorizer = {}
      config.apigateway.authorizer.functionName = json.apigateway.authorizer.functionName
      config.apigateway.authorizer.context = json.apigateway.authorizer.context
    }
  }
  return config
}

class AWSLocal {
  private initialized = false

  constructor(private readonly config: App.AWSLocal.Config) {
    dotenv.config({ path: config.lambda.env })
    process.env.AWS_REGION = config.aws.region
    process.env.AWS_PROFILE = config.aws.profile
    process.env.AWS_DEFAULT_REGION = config.aws.region
  }

  local(eventPath: string): void {
    this.initialize()
      .then(() => {
        eventPath = path.resolve(eventPath)
        if (!fs.existsSync(eventPath)) {
          logger.error(`Event file '${eventPath}' not found`)
          process.exit(0)
        }

        AWSLambda.create(this.config.lambda.path as string, this.config.lambda.handler)
          .then((lambdaFunction) => {
            const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'))
            lambdaFunction
              .invoke(event, this.config.lambda.timeout)
              .then(() => process.exit(0))
              .catch((e) => {
                this.__internalError(e)
              })
          })
          .catch((e) => {
            this.__internalError(e)
          })
      })
      .catch((err) => logger.error(err))
  }

  server(): void {
    this.initialize()
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
                            .catch((e) => this.__buildError(e))
                          break
                        case 'ANY-apigateway-invoke':
                          ApiGateway.buildInputMock(Buffer.concat(body).toString(), req, this.config.apigateway ?? {})
                            .then((mock) => {
                              lambdaFunction
                                .invoke(mock, this.config.lambda.timeout)
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
                                .catch((e) => {
                                  res.writeHead(500, { 'Content-Type': 'application/json' }).end(this.__buildError(e))
                                })
                            })
                            .catch(this.__buildError)
                          break
                        case 'POST-sns-invoke':
                          lambdaFunction
                            .invoke(SNS.buildInputMock(Buffer.concat(body).toString()), this.config.lambda.timeout)
                            .then((data) => {
                              res.writeHead(200, { 'Content-Type': 'application/json' }).end(data)
                            })
                            .catch((e) => {
                              res.writeHead(500, { 'Content-Type': 'application/json' }).end(this.__buildError(e))
                            })
                          break
                        case 'POST-sqs-invoke':
                          lambdaFunction
                            .invoke(SQS.buildInputMock(Buffer.concat(body).toString()), this.config.lambda.timeout)
                            .then((data) => {
                              res.writeHead(200, { 'Content-Type': 'application/json' }).end(data)
                            })
                            .catch((e) => {
                              res.writeHead(500, { 'Content-Type': 'application/json' }).end(this.__buildError(e))
                            })
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
                logger.info(`Started server on http://localhost:${this.config.port}`)
                logger.info(`Lambda emulator \t\tPOST \t/lambda-invoke`)
                logger.info(`API Gateway emulator \tANY \t/apigateway-invoke/{your-path}`)
                logger.info(`SNS emulator \t\tPOST \t/sns-invoke`)
                logger.info(`SQS emulator \t\tPOST \t/sqs-invoke`)
              })
          })
          .catch((e) => {
            this.__internalError(e)
          })
      })
      .catch((err) => logger.error(err))
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

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
    logger.error(
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
