declare namespace App {
  namespace Commander {
    interface Options {
      config: string
      lambdaHandler: string
      lambdaPath: string
      timeout: string
      profile: string
      region: string
      envPath: string
      eventPath: string
      port: string
      verbose: boolean
    }
  }
}
