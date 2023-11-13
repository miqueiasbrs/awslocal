declare namespace App {
  namespace AWS {
    namespace SNS {
      interface SNSRecord {
        EventSource: string
        EventVersion: string
        EventSubscriptionArn: string
        Sns: SNS
      }

      interface MessageAttributes {
        Type: 'Binary' | 'String'
        Value: string
      }

      interface SNS {
        Type: string
        MessageId: string
        TopicArn: string
        Subject: string | null
        Message: string
        Timestamp: string
        SignatureVersion: string
        Signature: string
        SigningCertUrl: string
        UnsubscribeUrl: string
        MessageAttributes?: Record<string, MessageAttributes>
      }
    }
  }
}
