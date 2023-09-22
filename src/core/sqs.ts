import { createHash, randomUUID } from 'crypto'

import { type AWSLambda } from './lambda.js'

interface MessageAttributes {
  stringValue?: string
  stringListValues?: string[]
  binaryListValues: number[]
  dataType: string
}
interface SQSRecord {
  messageGroupId?: string
  messageDeduplicationId?: string
  message: any
  messageAttributes?: Record<string, MessageAttributes>
}

export async function sqsInvoke(payload: string, lambdaFunction: AWSLambda, timeout: number): Promise<any> {
  const records: any = JSON.parse(payload)
  if (!Array.isArray(records)) return { snsError: true }
  if (records.length === 0) return { snsError: true }
  for (const record of records) if (!record.message) return { snsError: true }

  return await lambdaFunction.invoke(
    JSON.stringify({
      Records: (records as SQSRecord[]).map((x) => {
        return {
          messageId: randomUUID(),
          receiptHandle: createHash('sha256').update(x.message).digest('base64'),
          body: JSON.stringify(x.message),
          attributes: {
            ApproximateReceiveCount: '1',
            SentTimestamp: Date.now(),
            SequenceNumber: '18880744820282095616',
            MessageGroupId: x.messageGroupId,
            SenderId: 'XXXXXXXXXXXXXXXXXXXXX',
            MessageDeduplicationId: x.messageDeduplicationId,
            ApproximateFirstReceiveTimestamp: Date.now()
          },
          messageAttributes: x.messageAttributes,
          md5OfBody: createHash('md5').update(x.message).digest('hex'),
          md5OfMessageAttributes: createHash('md5')
            .update(JSON.stringify(x.messageAttributes ?? {}))
            .digest('hex'),
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn:aws:sqs:xx-xxxx-1:000000000000:your-sqs.fifo',
          awsRegion: 'xx-xxxx-1'
        }
      })
    }),
    timeout
  )
}
