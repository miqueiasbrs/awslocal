import crypto from 'node:crypto'

import type { SQSEvent, SQSMessageAttributes } from 'aws-lambda'
import type { LambdaEmulator } from './lambda.js'

export class SQSEmulator {
  private constructor(private readonly lambdaEmulator: LambdaEmulator) {}

  static instance(lambdaEmulator: LambdaEmulator) {
    return new SQSEmulator(lambdaEmulator)
  }

  async invoke(records: Array<SQSEmulatorMessage & { messageAttributes: SQSMessageAttributes }>, timeout: number) {
    const region = process.env.AWS_DEFAULT_REGION ?? 'xx-xxxx-0'
    const queue = 'awslocal-queue'

    const event: SQSEvent = {
      Records: records.map((x) => {
        return {
          messageId: crypto.randomUUID(),
          receiptHandle: crypto.createHash('sha256').update(x.body).digest('base64'),
          body: JSON.stringify(x.body),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: Date.now().toString(),
            SequenceNumber: '18880744820282095616',
            MessageGroupId: crypto.randomUUID(),
            SenderId: 'XXXXXXXXXXXXXXXXXXXXX',
            MessageDeduplicationId: crypto.randomUUID(),
            ApproximateFirstReceiveTimestamp: Date.now().toString()
          },
          messageAttributes: x.messageAttributes,
          md5OfBody: crypto.createHash('md5').update(x.body).digest('hex'),
          md5OfMessageAttributes: crypto
            .createHash('md5')
            .update(JSON.stringify(x.messageAttributes ?? {}))
            .digest('hex'),
          eventSource: 'aws:sqs',
          eventSourceARN: `arn:aws:sqs:${region}:000000000000:${queue}.fifo`,
          awsRegion: region
        }
      })
    }

    await this.lambdaEmulator.invoke(JSON.stringify(event), timeout)
  }
}
