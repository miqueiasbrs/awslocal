export interface APIGatewayRoute {
  path: string
  method: string
  hasAuthorizer: boolean
}

export interface APIGatewayAuthorizer {
  context?: Record<string, string | number | boolean | undefined>
  functionName?: string
}

export interface APIGatewayConfig {
  restApiId?: string
  routes: APIGatewayRoute[]
  authorizer?: APIGatewayAuthorizer
}

export interface AWSLocalConfig {
  lambdaPath: string
  lambdaHandler: string
  lambdaTimeout: number
  port: number
  apigateway?: APIGatewayConfig
}
