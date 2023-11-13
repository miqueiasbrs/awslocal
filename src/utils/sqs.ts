import { createHash } from 'crypto'

import { v4 } from 'uuid'

export function buildInputMock(payload: string): App.AWS.SQS.MockRecords | { sqsError: true } {
  const records: App.AWS.SQS.MockRecords = JSON.parse(payload)
  if (!Array.isArray(records)) return { sqsError: true }
  if (records.length === 0) return { sqsError: true }
  for (const record of records) if (!record.Sns) return { sqsError: true }

  return {
    Records: records.map((x) => {
      let messageAttributes: any = null
      if (x.messageAttributes) {
        messageAttributes = {}
        for (const [key, value] of Object.entries<App.AWS.SQS.MessageAttributes>(x.messageAttributes)) {
          messageAttributes[key] = {
            stringValue: value.stringValue,
            stringListValues: value.stringListValues,
            binaryListValues: value.binaryListValues,
            dataType: value.dataType
          }
        }
      }

      return {
        messageId: v4(),
        receiptHandle: v4(),
        body: JSON.stringify(x.message),
        attributes: {
          ApproximateReceiveCount: Math.floor(Math.random() * (9 - 1) + 1).toString(),
          SentTimestamp: Date.now().toString(),
          SequenceNumber: new Array(20).map(() => Math.floor(Math.random() * (9 - 1) + 1)).join(''),
          MessageGroupId: x.messageGroupId,
          SenderId: 'AIDAQENK3FIFCDHXVSPWJ',
          MessageDeduplicationId: x.messageDeduplicationId,
          ApproximateFirstReceiveTimestamp: Date.now().toString()
        },
        messageAttributes,
        md5OfBody: createHash('md5').update(JSON.stringify(x.message)).digest('hex'),
        md5OfMessageAttributes: createHash('md5').update(JSON.stringify(messageAttributes)).digest('hex'),
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:xx-xxxx-1:000000000000:xxxxx.fifo',
        awsRegion: 'xx-xxxx-1'
      }
    })
  }
}
