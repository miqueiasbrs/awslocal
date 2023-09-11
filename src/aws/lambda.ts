import { randomUUID } from 'crypto'
import { freemem } from 'os'
import path from 'path'
import { isAsyncFunction } from 'util/types'

import { logger } from '../utils/logger.js'

export type LambdaFunction = (evt: any, ctx: any) => Promise<any>

class LambdaTimeoutError extends Error {}
class LambdaContext {
  callbackWaitsForEmptyEventLoop = false
  functionVersion = '$LATEST'
  functionName = 'lambdalocal'
  memoryLimitInMB = Math.floor(freemem() / 1048576).toString()
  logGroupName = '/aws/lambda/lambdalocal'
  logStreamName = `${new Date().toISOString().split('T')[0].replace('-', '/')}/[$LATEST]${randomUUID()}`
  invokedFunctionArn = 'arn:aws:lambda:xx-xxxx-0:000000000000:function:lambdalocal'
  awsRequestId = randomUUID()

  // eslint-disable-next-line n/handle-callback-err, @typescript-eslint/no-empty-function
  done(error?: Error, result?: any): void {}
  // eslint-disable-next-line n/handle-callback-err, @typescript-eslint/no-empty-function
  fail(error: Error | string): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  succeed(messageOrObject: string, object: any): void {}

  getRemainingTimeInMillis(): number {
    return 0
  }
}

export class AWSLambdaInvoke {
  constructor(private readonly lambdaFunction: LambdaFunction) {}

  async invoke(event: any, timeout: number): Promise<any> {
    const start = new Date().getTime()
    if (typeof event === 'string') {
      event = JSON.parse(event)
    }

    try {
      const context = new LambdaContext()
      logger.info('START RequestId:', context.awsRequestId)
      const result = await Promise.race([this.lambdaFunction(event, context), this.__lambdaTimeout(timeout)])
      logger.info('End - Result:')
      logger.info(result ? JSON.stringify(result, null, 4) : '')
      logger.info(`Lambda successfully executed in ${new Date().getTime() - start}ms.`)
      return result
    } catch (err: any) {
      const result = {
        errorMessage: err.message,
        errorType: err.constructor.name,
        stackTrace: err.stack
          .split('\n')
          .filter((f: string) => f !== err.constructor.name)
          .map((m: string) => m.replace('at ', '').trim())
      }
      logger.error(JSON.stringify(result, null, 4))
      logger.error(`Lambda failed in ${new Date().getTime() - start}ms.`)
      return result
    }
  }

  private async __lambdaTimeout(timeout: number): Promise<void> {
    await new Promise((resolve, reject) => {
      setTimeout(function () {
        reject(new LambdaTimeoutError(`Task timed out after ${timeout} seconds`))
      }, timeout * 1000)
    })
  }

  static async create(lambdaPath: string, handler: string): Promise<AWSLambdaInvoke> {
    const module = await import(lambdaPath.trim())
    let lambdaHandler: LambdaFunction = (module.default ?? module)[handler]
    if (!isAsyncFunction(lambdaHandler)) {
      lambdaHandler = async function (evt: any, ctx: any) {
        return await new Promise((resolve) => {
          module[handler](evt, ctx, (data: any) => {
            resolve(data)
          })
        })
      }
    }

    return new AWSLambdaInvoke(lambdaHandler)
  }
}
