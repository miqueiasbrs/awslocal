declare namespace App {
  namespace AWS {
    namespace SQS {
      interface MockRecords {
        Records: Records[]
      }

      interface MessageAttributes {
        stringValue: string
        stringListValues: string[]
        binaryListValues: string[]
        dataType: string
      }

      interface Records {
        messageId: string
        receiptHandle: string
        body: string
        attributes: Record<string, string>
        messageAttributes: Record<string, MessageAttributes>
        md5OfBody: string
        md5OfMessageAttributes: string
        eventSource: string
        eventSourceARN: string
        awsRegion: string
      }
    }
  }
}
