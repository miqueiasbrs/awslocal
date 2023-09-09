import fs from 'fs'
import http from 'http'
import path from 'path'

import { type APIGatewayConfig, AWSApiGatewayInvoke } from './aws/apigateway.js'
import { AWSLambdaInvoke } from './aws/lambda.js'
import { logger } from './utils/logger.js'

export class AWSLocalConfig {
  constructor(
    readonly lambdaPath: string,
    readonly handler: string = 'handler',
    readonly timeout: number = 3,
    readonly profile: string = 'default',
    readonly region: string = 'us-east-1',
    readonly envPath: string = '.env',
    readonly port: number = 9000,
    readonly apigateway?: Omit<APIGatewayConfig, 'lambdaInvoke'>
  ) {
    if (timeout && !isNaN(timeout)) {
      this.timeout = parseInt(timeout.toString())
    } else {
      logger.system.warn(`Invalid timeout: ${timeout}, set default to 3`)
      this.timeout = 3
    }

    if (port && !isNaN(port) && parseInt(port.toString()) >= 1 && parseInt(port.toString()) <= 65535) {
      this.port = parseInt(port.toString())
    } else {
      logger.system.warn(`Invalid port: ${port}, set default to 9000`)
      this.port = 9000
    }

    if (apigateway) {
      this.apigateway = {
        restApiId: apigateway.restApiId,
        routes: (apigateway.routes ?? []).map((x) => ({
          path: x.path,
          method: x.method,
          hasAuthorizer: x.hasAuthorizer
        })),
        authorizer: apigateway.authorizer
          ? {
              context: apigateway.authorizer.context,
              functionName: apigateway.authorizer.functionName
            }
          : undefined
      }
    }

    this.lambdaPath = path.resolve(lambdaPath.trim())
    this.envPath = path.resolve(envPath)
  }

  private __loadEnv(): void {
    process.env.AWS_REGION = this.region
    process.env.AWS_PROFILE = this.profile
    process.env.AWS_DEFAULT_REGION = this.region

    if (fs.existsSync(this.envPath)) {
      const env = fs.readFileSync(this.envPath, 'utf8')
      env.split('\n').forEach((i) => {
        const kv: any[] = i.split('=')
        process.env[kv[0]] = kv.length > 1 ? kv[1] : undefined
      })
    } else logger.system.warn(`Not found env file: ${this.envPath} to load environment variables`)
  }

  static createInitFile(): void {
    fs.writeFileSync(
      '.awslocal.json',
      JSON.stringify(
        {
          lambdaPath: 'path/to/handler',
          handler: 'handler',
          timeout: 3,
          profile: 'default',
          region: 'us-east-1',
          envPath: '.env',
          port: 9000,
          apigateway: {
            restApiId: 'your-rest-api-id',
            routes: [
              {
                path: 'your/path/:id',
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
        },
        null,
        2
      )
    )
    process.exit(0)
  }

  static loadConfigFile(configPath: string): AWSLocalConfig {
    if (!fs.existsSync(path.resolve(configPath))) {
      logger.system.error(`Config file '${path.resolve(configPath)}' not found`)
    }

    try {
      const configJson = JSON.parse(fs.readFileSync(path.resolve(configPath), 'utf8'))
      const config = new AWSLocalConfig(
        configJson.lambdaPath,
        configJson.handler,
        configJson.timeout,
        configJson.profile,
        configJson.region,
        configJson.envPath,
        configJson.port,
        configJson.apigateway
      )

      if (config.lambdaPath && !fs.existsSync(config.lambdaPath)) {
        logger.system.error(`Lambda path '${config.lambdaPath}' not found`)
        process.exit(0)
      }

      config.__loadEnv()

      return config
    } catch (error: any) {
      logger.system.error(`Config file '${path.resolve(configPath)}' is not valid JSON: ${error.message}`)
      process.exit(0)
    }
  }
}

export class AWSLocal {
  constructor(private readonly config: AWSLocalConfig) {}

  startServer(): void {
    AWSLambdaInvoke.create(this.config.lambdaPath, this.config.handler)
      .then((lambdaInvoke) => this.__createServer(lambdaInvoke))
      .catch((err) => {
        throw err
      })
  }

  private __createServer(lambdaInvoke: AWSLambdaInvoke): http.Server {
    const apigatewayInvoke = new AWSApiGatewayInvoke({
      ...this.config.apigateway,
      lambdaInvoke
    })

    return http
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
                  lambdaInvoke
                    .invoke(Buffer.concat(body).toString(), this.config.timeout)
                    .then((data) => {
                      if (data.errorType)
                        res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
                      else res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
                    })
                    .catch(this.__buildError)
                  break
                case 'ANY-apigateway-invoke':
                  apigatewayInvoke
                    .invoke(Buffer.concat(body).toString(), req, this.config.timeout)
                    .then((data) => {
                      if (data?.errorType) {
                        res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
                      } else if (data) {
                        res
                          .writeHead(
                            data.statusCode,
                            Object.assign(data.headers ?? {}, { 'Content-Type': 'application/json' })
                          )
                          .end(JSON.stringify(data.body))
                      } else res.writeHead(403).end()
                    })
                    .catch(this.__buildError)
                  break
                case 'POST-sns-invoke':
                  break
                case 'POST-sqs-invoke':
                  break
                default: {
                  res.writeHead(400, { 'Content-Type': 'application/json' }).end(this.__buildInvokeError())
                  break
                }
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
}
