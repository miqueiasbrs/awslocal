import crypto from 'node:crypto'
import type http from 'node:http'

import { APIGatewayClient, GetResourcesCommand, type Resource } from '@aws-sdk/client-api-gateway'
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventPathParameters,
  ProxyResult
} from 'aws-lambda'
import { match } from 'path-to-regexp'

import type { LambdaEmulator } from './lambda.js'

class APIGatewayRouteError extends Error {}
class APIGatewayAuthorizerError extends Error {}

export class APIGatewayEmulator {
  private constructor(
    private readonly lambdaEmulator: LambdaEmulator,
    private readonly config: APIGatewayEmulatorConfig
  ) {}

  static async instance(lambdaEmulator: LambdaEmulator, config: APIGatewayEmulatorConfig) {
    if (config.restApiId) {
      const client = new APIGatewayClient({})
      const resourcesCommand = new GetResourcesCommand({ restApiId: config.restApiId, embed: ['methods'] })
      do {
        const resources = await client.send(resourcesCommand)

        for (const item of resources.items ?? [])
          config.routes.push(...APIGatewayEmulator._getRoutesFromAPIGateway(item))

        resourcesCommand.input.position = resources.position
      } while (resourcesCommand.input.position)
    }
    return new APIGatewayEmulator(lambdaEmulator, config)
  }

  private static _getRoutesFromAPIGateway(item: Resource): Route[] {
    const routes: Route[] = []
    const resource: string = (item.path ?? '').replaceAll('{', ':').replaceAll('}', '')
    for (const method of Object.keys(item.resourceMethods ?? {}).filter((f) => f !== 'OPTIONS')) {
      const hasAuthorizer = !!item.resourceMethods?.[method]?.authorizerId
      if (method === 'ANY') {
        routes.push(
          { resource, method: 'GET', hasAuthorizer },
          { resource, method: 'PUT', hasAuthorizer },
          { resource, method: 'POST', hasAuthorizer },
          { resource, method: 'PATCH', hasAuthorizer },
          { resource, method: 'DELETE', hasAuthorizer }
        )
      } else routes.push({ resource, method: method as HttpMethod, hasAuthorizer })
    }

    return routes
  }

  async invoke(payload: string | null, request: http.IncomingMessage, timeout: number): Promise<ProxyResult> {
    const event = await this._convertHttpRequestToProxyEvent(payload, request)
    const response = await this.lambdaEmulator.invoke(JSON.stringify(event), timeout)
    return {
      statusCode: response.statusCode,
      headers: response.headers,
      multiValueHeaders: response.multiValueHeaders,
      body: response.body,
      isBase64Encoded: response.isBase64Encoded
    }
  }

  private async _convertHttpRequestToProxyEvent(
    payload: string | null,
    request: http.IncomingMessage
  ): Promise<APIGatewayProxyEvent> {
    const url = new URL(request.url ?? '', `http://${request.headers.host}`)
    const pathname = url.pathname.replace('/apigateway-invoke', '')
    const route = this._getRouteByResource(pathname, request.method as string)

    const event: APIGatewayProxyEvent = {
      body: payload,
      headers: {
        'X-Amzn-Trace-Id': `Root=1-${crypto.randomUUID()}`,
        'X-Forwarded-For': '127.0.0.0',
        'X-Forwarded-Port': url.port,
        'X-Forwarded-Proto': url.protocol.slice(0, -1)
      },
      multiValueHeaders: {},
      httpMethod: request.method as string,
      isBase64Encoded: false,
      path: pathname,
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        accountId: '000000000000',
        apiId: crypto.randomUUID().replaceAll('-', '').substring(0, 10),
        authorizer: null,
        domainName: url.hostname,
        domainPrefix: url.hostname.split('.')[0],
        extendedRequestId: 'eMpJIFLVoAMEveQ=',
        protocol: 'HTTP/1.1',
        httpMethod: request.method as string,
        identity: {
          cognitoIdentityPoolId: null,
          accountId: null,
          cognitoIdentityId: null,
          caller: null,
          sourceIp: '127.0.0.0',
          principalOrgId: null,
          accessKey: null,
          cognitoAuthenticationType: null,
          cognitoAuthenticationProvider: null,
          userArn: null,
          userAgent: request.headers['user-agent'] as string,
          user: null,
          apiKey: null,
          apiKeyId: null,
          clientCert: null
        },
        path: pathname,
        stage: 'v1',
        requestId: crypto.randomUUID(),
        requestTime: new Date().toISOString(),
        requestTimeEpoch: Date.now(),
        resourceId: 'tm6p9y',
        resourcePath: ''
      },
      resource: ''
    }

    event.pathParameters = this._getPathParametersByPathToRegExp(route)
    event.headers = this._getHeadersByRequestHeaders(request.headers)
    event.multiValueHeaders = this._getMultiValueHeadersByEventProxy(event.headers)

    for (const k of url.searchParams.keys()) {
      if (event.queryStringParameters === null) event.queryStringParameters = {}
      if (event.multiValueQueryStringParameters === null) event.multiValueQueryStringParameters = {}

      event.queryStringParameters[k] = url.searchParams.get(k) as string
      event.multiValueQueryStringParameters[k] = url.searchParams.getAll(k)
    }

    event.requestContext.authorizer = await this._getAuthorizerContext(route, event)
    return event
  }

  private async _getAuthorizerContext(route: Route, event: APIGatewayProxyEvent) {
    if (route.hasAuthorizer && this.config.authorizer?.functionName) {
      const client = new LambdaClient({})
      const lambda = await client.send(
        new InvokeCommand({
          FunctionName: this.config.authorizer.functionName,
          Payload: JSON.stringify({ type: 'REQUEST', ...event })
        })
      )

      if (lambda.Payload) {
        const payload = JSON.parse(Buffer.from(lambda.Payload).toString())
        return payload.context
      }
    } else if (route.hasAuthorizer && this.config.authorizer?.context) {
      return this.config.authorizer.context
    } else if (route.hasAuthorizer) throw new APIGatewayAuthorizerError('Authorizer not configured')
  }

  private _getRouteByResource(pathname: string, method: string) {
    const routes = this.config.routes ?? []
    const route = routes.find((f, i) => {
      const fn = match(f.resource.replaceAll('{', ':').replaceAll('}', ''))
      const extract = fn(pathname)

      if (!extract) return false
      routes[i].pathToRegExp = extract
      return f.method === method
    })

    if (!route) throw new APIGatewayRouteError('Route not configured'.concat(' ', pathname))
    return route
  }

  private _getPathParametersByPathToRegExp(route: Route) {
    let pathParameters: APIGatewayProxyEventPathParameters | null = null
    for (const k of Object.keys(route.pathToRegExp?.params ?? {})) {
      if (pathParameters === null) pathParameters = {}
      pathParameters[k] = (route.pathToRegExp?.params ?? ({} as any))[k] ?? undefined
    }
    return pathParameters
  }

  private _getHeadersByRequestHeaders(headers: http.IncomingHttpHeaders) {
    const output: any = {}
    for (const [key, value] of Object.entries(headers)) output[key] = Array.isArray(value) ? value[0] : value
    return output
  }

  private _getMultiValueHeadersByEventProxy(headers: APIGatewayProxyEventHeaders) {
    const output: any = {}
    for (const i of Object.keys(headers)) output[i] = [headers[i] as string]
    return output
  }
}
