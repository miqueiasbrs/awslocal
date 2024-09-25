import crypto from 'node:crypto'

import type { SNSEvent } from 'aws-lambda'
import type { LambdaEmulator } from './lambda.js'

export class SNSEmulator {
  private constructor(private readonly lambdaEmulator: LambdaEmulator) {}

  static instance(lambdaEmulator: LambdaEmulator) {
    return new SNSEmulator(lambdaEmulator)
  }

  async invoke(records: Array<SNSEmulatorMessage>, timeout: number) {
    const region = process.env.AWS_DEFAULT_REGION ?? 'xx-xxxx-0'
    const topic = 'awslocal-topic'

    const event: SNSEvent = {
      Records: records.map((x) => {
        return {
          EventVersion: '1.0',
          EventSubscriptionArn: `arn:aws:sns:${region}:000000000000:${topic}:${crypto.randomUUID()}`,
          EventSource: 'aws:sns',
          Sns: {
            SignatureVersion: '1',
            Timestamp: new Date().toISOString(),
            Signature: crypto.createHash('sha256').update(x.Message).digest('base64'),
            SigningCertUrl: `https://sns.${region}.amazonaws.com/SimpleNotificationService-${crypto.randomUUID()}.pem`,
            MessageId: crypto.randomUUID(),
            Message: JSON.stringify(x.Message),
            MessageAttributes: x.MessageAttributes ?? {},
            Type: 'Notification',
            UnsubscribeUrl: `https://sns.${region}.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:${region}:000000000000:${topic}:${crypto.randomUUID()}`,
            TopicArn: `arn:aws:sns:${region}:000000000000:${topic}`,
            Subject: (x.Subject as string) ?? null
          }
        }
      })
    }

    await this.lambdaEmulator.invoke(JSON.stringify(event), timeout)
  }
}
