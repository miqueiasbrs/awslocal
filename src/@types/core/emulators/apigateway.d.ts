declare type APIGatewayEmulatorConfig = {
  restApiId?: string
  routes: Route[]
  authorizer: AuthorizerConfig
}

type HttpMethod = 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' | 'ANY'
type Route = {
  resource: string
  method: HttpMethod
  hasAuthorizer: boolean
  pathToRegExp?: MatchResult<object>
}

type Context = Record<string, string>
type AuthorizerConfig = {
  context?: Context
  functionName?: string
}
