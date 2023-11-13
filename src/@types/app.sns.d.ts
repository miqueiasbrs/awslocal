declare namespace App {
  namespace AWS {
    namespace SNS {
      interface MockRecords {
        Records: Records[]
      }

      interface MessageAttributes {
        Type: 'Binary' | 'String'
        Value: string
      }

      interface Records {
        EventSource: string
        EventVersion: string
        EventSubscriptionArn: string
        Sns: SNS
      }

      interface SNS {
        Type: string
        MessageId: string
        TopicArn: string
        Subject: string
        Message: string
        Timestamp: string
        SignatureVersion: string
        Signature: string
        SigningCertUrl: string
        UnsubscribeUrl: string
        MessageAttributes: Record<string, MessageAttributes>
      }
    }
  }
}
