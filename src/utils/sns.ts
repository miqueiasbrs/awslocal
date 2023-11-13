import { createHash } from 'crypto'

import { v4 } from 'uuid'

export function buildInputMock(payload: string): App.AWS.SNS.MockRecords | { snsError: boolean } {
  const records: App.AWS.SNS.MockRecords = JSON.parse(payload)
  if (!Array.isArray(records)) return { snsError: true }
  if (records.length === 0) return { snsError: true }
  for (const record of records) if (!record.Sns) return { snsError: true }

  return {
    Records:
      records.map((x) => {
        return {
          EventSource: 'aws:sns',
          EventVersion: '1.0',
          EventSubscriptionArn: `arn:aws:sns:xx-xxxx-1:000000000000:your-topic:${v4()}`,
          Sns: {
            Type: 'Notification',
            MessageId: v4(),
            TopicArn: `arn:aws:sns:xx-xxxx-1:000000000000:your-topic`,
            Subject: x.Sns.Subject ?? null,
            Message: JSON.stringify(x.Sns.Message),
            Timestamp: new Date().toISOString(),
            SignatureVersion: '1',
            Signature: createHash('sha256').update(x.Sns.Message).digest('base64'),
            SigningCertUrl: `https://sns.xx-xxxx-1.amazonaws.com/SimpleNotificationService-${v4()}.pem`,
            UnsubscribeUrl: `https://sns.xx-xxxx-1.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:xx-xxxx-1:000000000000:your-topic:${v4()}`,
            MessageAttributes: x.Sns.MessageAttributes ?? {}
          }
        }
      }) ?? []
  }
}
