declare type SNSEmulatorMessage = {
  Subject?: string
  Message: any
  MessageAttributes?: {
    [key: string]: {
      Type: string
      Value: string
    }
  }
}
