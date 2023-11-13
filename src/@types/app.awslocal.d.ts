declare namespace App {
  namespace AWSLocal {
    interface Lambda {
      path?: string
      handler: string
      timeout: number
      env: string
    }
    interface AWS {
      region: string
      profile: string
    }
    interface APIGatewayRoute {
      method: string
      resource: string
      hasAuthorizer: boolean
    }
    interface APIGatewayAuthorizer {
      context?: Record<string, string | number | boolean | undefined>
      functionName?: string
    }
    interface APIGateway {
      restApiId?: string
      resources?: APIGatewayRoute[]
      authorizer?: APIGatewayAuthorizer
    }
    interface Config {
      lambda: Lambda
      aws: AWS
      port: number
      apigateway?: APIGateway
    }
  }
}
