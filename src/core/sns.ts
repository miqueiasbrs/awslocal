import { createHash, randomUUID } from 'crypto'

import { type AWSLambda } from './lambda.js'

interface MessageAttributes {
  Type: 'Binary' | 'String'
  Value: string
}
interface SNSRecord {
  subject?: string
  message: any
  messageAttributes?: Record<string, MessageAttributes>
}

export async function snsInvoke(payload: string, lambdaFunction: AWSLambda, timeout: number): Promise<any> {
  const records: any = JSON.parse(payload)
  if (!Array.isArray(records)) return { snsError: true }
  if (records.length === 0) return { snsError: true }
  for (const record of records) if (!record.message) return { snsError: true }

  return await lambdaFunction.invoke(
    JSON.stringify({
      Records: (records as SNSRecord[]).map((x) => {
        return {
          EventSource: 'aws:sns',
          EventVersion: '1.0',
          EventSubscriptionArn: `arn:aws:sns:xx-xxxx-1:000000000000:your-topic:${randomUUID()}`,
          Sns: {
            Type: 'Notification',
            MessageId: randomUUID(),
            TopicArn: `arn:aws:sns:xx-xxxx-1:000000000000:your-topic`,
            Subject: x.subject ?? null,
            Message: JSON.stringify(x.message),
            Timestamp: new Date().toISOString(),
            SignatureVersion: '1',
            Signature: createHash('sha256').update(x.message).digest('base64'),
            SigningCertUrl: `https://sns.xx-xxxx-1.amazonaws.com/SimpleNotificationService-${randomUUID()}.pem`,
            UnsubscribeUrl: `https://sns.xx-xxxx-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:xx-xxxx-1:000000000000:your-topic:${randomUUID()}`,
            MessageAttributes: x.messageAttributes ?? {}
          }
        }
      })
    }),
    timeout
  )
}
