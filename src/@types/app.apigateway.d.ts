declare namespace App {
  namespace AWS {
    namespace ApiGateway {
      type Type = 'REQUEST' | 'TOKEN'
      type Headers = Record<string, string>
      type MultiValueHeaders = Record<string, string[]>
      type PathParameters = Record<string, string>
      type StageVariables = Record<string, string> | null
      type QueryStringParameters = Record<string, string>
      type MultiValueQueryStringParameters = Record<string, string[]>
      type HttpMethod = 'ANY' | 'PUT' | 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'DELETE' | 'OPTIONS'
      type Authorizer = Record<string, string | number | boolean | undefined>

      interface Identity {
        sourceIp: string
        user?: string | null
        apiKey?: string | null
        caller?: string | null
        userArn?: string | null
        apiKeyId?: string | null
        userAgent?: string | null
        accountId?: string | null
        accessKey?: string | null
        principalOrgId?: string | null
        cognitoIdentityId?: string | null
        cognitoIdentityPoolId?: string | null
        cognitoAuthenticationType?: string | null
        cognitoAuthenticationProvider?: string | null
      }

      interface Context {
        path: string
        stage: string
        apiId: string
        protocol: string
        accountId: string
        requestId: string
        resourceId: string
        resourcePath: string
        requestTimeEpoch: number
        httpMethod: HttpMethod
        identity: Identity
        domainName?: string
        requestTime?: string
        domainPrefix?: string
        extendedRequestId?: string
        authorizer?: Authorizer | null
      }

      interface Request {
        resource: string
        path: string
        httpMethod: HttpMethod
        headers: Headers
        multiValueHeaders: MultiValueHeaders
        queryStringParameters: QueryStringParameters | null
        multiValueQueryStringParameters: MultiValueQueryStringParameters | null
        pathParameters: PathParameters | null
        stageVariables: StageVariables
        requestContext: Context
        body?: string
        isBase64Encoded?: boolean
        type?: Type
        methodArn?: string
        authorizationToken?: string
      }
    }
  }
}
