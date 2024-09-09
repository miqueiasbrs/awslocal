import crypto from 'node:crypto'
import os from 'node:os'

import { isAsyncFunction } from 'node:util/types'

import type { Context } from 'aws-lambda'

import logger from '../utils/logger.js'

class LambdaTimeoutError extends Error {}

function createLambdaContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'lambdalocal',
    functionVersion: '$LATEST',
    memoryLimitInMB: Math.floor(os.freemem() / 1048576).toString(),
    logGroupName: '/aws/lambda/lambdalocal',
    logStreamName: `${new Date().toISOString().split('T')[0].replace('-', '/')}/[$LATEST]${crypto.randomUUID()}`,
    invokedFunctionArn: 'arn:aws:lambda:xx-xxxx-0:000000000000:function:lambdalocal',
    awsRequestId: crypto.randomUUID(),
    getRemainingTimeInMillis: () => 0,
    done: () => {},
    fail: () => {},
    succeed: () => {}
  }
}

export type LambdaFunction = (evt: any, ctx: any) => Promise<any>
export class AWSLambda {
  constructor(private readonly lambdaFunction: LambdaFunction) {}

  async invoke(event: any, timeout: number): Promise<any> {
    const start = new Date().getTime()
    const parsedEvent = typeof event === 'string' ? JSON.parse(event) : event

    try {
      const context: Context = createLambdaContext()

      logger.info('START RequestId:', context.awsRequestId)
      const result = await Promise.race([this.lambdaFunction(parsedEvent, context), this.__lambdaTimeout(timeout)])
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
    await new Promise((_, reject) => {
      setTimeout(() => {
        reject(new LambdaTimeoutError(`Task timed out after ${timeout} seconds`))
      }, timeout * 1000)
    })
  }

  static async create(lambdaPath: string, handler: string): Promise<AWSLambda> {
    const module = await import(lambdaPath.trim())
    let lambdaHandler: LambdaFunction = (module.default ?? module)[handler]
    if (!isAsyncFunction(lambdaHandler)) {
      lambdaHandler = async (evt: any, ctx: any) =>
        await new Promise((resolve) => {
          module[handler](evt, ctx, (data: any) => {
            resolve(data)
          })
        })
    }

    return new AWSLambda(lambdaHandler)
  }
}
