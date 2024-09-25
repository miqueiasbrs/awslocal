declare interface AWSLocalConfig {
  aws: {
    profile: string
    region: string
  }
  lambda: {
    path?: string
    handler: string
    timeout: number
    envPath: string
  }
  serverPort: number
  apigateway: {
    restApiId?: string
    routes: Array<{
      resource: string
      method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' | 'ANY'
      hasAuthorizer: boolean
    }>
    authorizer: {
      context?: Record<string, string>
      functionName?: string
    }
  }
}
