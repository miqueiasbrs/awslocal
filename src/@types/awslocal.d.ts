declare namespace App {
  interface AWSLambdaConfig {
    path?: string
    handler: string
    timeout: number
    envPath: string
  }

  interface AWSConfig {
    profile: string
    region: string
  }

  interface APIGatewayConfig {
    restApiId?: string
    routes: APIGatewayRouteConfig[]
    authorizer: APIGatewayAuthorizerConfig
  }

  interface APIGatewayRouteConfig {
    resource: string
    method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' | 'ANY'
    hasAuthorizer: boolean
  }

  interface APIGatewayAuthorizerConfig {
    context?: Record<string, string>
    functionName?: string
  }

  interface AWSLocalConfig {
    aws: AWSConfig
    lambda: AWSLambdaConfig

    serverPort: number

    apigateway: APIGatewayConfig
  }
}
