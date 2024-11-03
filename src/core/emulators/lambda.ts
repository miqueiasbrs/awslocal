import crypto from 'node:crypto'
import os from 'node:os'

import chalk from 'chalk'

import { isAsyncFunction } from 'node:util/types'
import type { Context, Handler } from 'aws-lambda'

class LambdaTimeoutError extends Error {}

export class LambdaEmulator {
  private readonly _logger = {
    info: (...args: any[]) => console.log(chalk.green('info:'), ...args),
    warn: (...args: any[]) => console.log(chalk.yellow('warn:'), ...args),
    error: (...args: any[]) => console.log(chalk.red('error:'), ...args)
  }

  private constructor(private readonly lambdaFunction: Handler) {}

  static async instance(lambdaPath: string, handler: string) {
    const module = await import(lambdaPath.trim())
    let lambdaHandler: Handler = (module.default ?? module)[handler]
    if (!isAsyncFunction(lambdaHandler)) {
      lambdaHandler = async (evt: any, ctx: Context) =>
        await new Promise((resolve) => {
          module[handler](evt, ctx, (data: any) => {
            resolve(data)
          })
        })
    }

    return new LambdaEmulator(lambdaHandler)
  }

  async invoke(event: any, timeout: number) {
    const start = new Date().getTime()
    const parsedEvent = typeof event === 'string' ? JSON.parse(event) : event

    let result: any
    try {
      const context = this._createLambdaContext()

      this._logger.info('START RequestId:', context.awsRequestId)
      result = await Promise.race([this.lambdaFunction(parsedEvent, context, () => {}), this._timeout(timeout)])
      this._logger.info('End - Result:')
      this._logger.info(result ? JSON.stringify(result, null, 4) : '')
      this._logger.info(`Lambda successfully executed in ${new Date().getTime() - start}ms.`)
    } catch (e: any) {
      result = this._normalizeEmulatorError(e)
      this._logger.error(JSON.stringify(result, null, 4))
      this._logger.error(`Lambda failed in ${new Date().getTime() - start}ms.`)
    }

    return result
  }

  private _createLambdaContext(): Context {
    const functionName = 'lambdaLocalEmulator'
    const region = process.env.AWS_DEFAULT_REGION ?? 'xx-xxxx-0'
    const account = '000000000000'

    return {
      callbackWaitsForEmptyEventLoop: false,
      functionName,
      functionVersion: '$LATEST',
      memoryLimitInMB: Math.floor(os.freemem() / 1048576).toString(),
      logGroupName: '/aws/lambda/'.concat(functionName),
      logStreamName: `${new Date().toISOString().split('T')[0].replace('-', '/')}/[$LATEST]${crypto.randomUUID()}`,
      invokedFunctionArn: ['arn:aws:lambda', region, account, 'function', functionName].join(':'),
      awsRequestId: crypto.randomUUID(),
      getRemainingTimeInMillis: () => 0,
      done: () => {},
      fail: () => {},
      succeed: () => {}
    }
  }

  private _normalizeEmulatorError(err: any) {
    return {
      errorMessage: err.message,
      errorType: err.constructor.name,
      stackTrace: err.stack
        .split('\n')
        .filter((f: string) => f !== err.constructor.name)
        .map((m: string) => m.replace('at ', '').trim())
    }
  }

  private async _timeout(timeout: number) {
    await new Promise((_, reject) =>
      setTimeout(() => {
        reject(new LambdaTimeoutError(`Task timed out after ${timeout} seconds`))
      }, timeout * 1000)
    )
  }
}
