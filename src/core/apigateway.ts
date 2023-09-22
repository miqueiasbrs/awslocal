import { randomUUID } from 'crypto'

import { APIGatewayClient, GetResourcesCommand } from '@aws-sdk/client-api-gateway'

import { type APIGatewayConfig, type APIGatewayRoute } from './config.js'
import { type AWSLambda } from './lambda.js'

import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import type http from 'http'
import { match, type MatchResult } from 'path-to-regexp'

const settings: APIGatewayConfig & { hasInitialized: boolean } = {
  hasInitialized: false,
  routes: []
}

export async function apigatewayInvoke(
  payload: string,
  req: http.IncomingMessage,
  lambdaFunction: AWSLambda,
  config: APIGatewayConfig,
  timeout: number
): Promise<any> {
  await initialize(config)
  const inputMock = await buildInputMock(payload, req)
  if (!inputMock) return
  const data = await lambdaFunction.invoke(inputMock, timeout)
  return data
}

async function initialize(config: APIGatewayConfig): Promise<void> {
  if (settings.hasInitialized) return

  if (config.restApiId) {
    const client = new APIGatewayClient({})

    const resourcesCommand = new GetResourcesCommand({ restApiId: config.restApiId, embed: ['methods'] })
    do {
      const resources = await client.send(resourcesCommand)
      resources.items?.forEach((item: any) => {
        const path: string = item.path.replaceAll('{', ':').replaceAll('}', '')

        Object.keys(item.resourceMethods ?? {})
          .filter((f) => f !== 'OPTIONS')
          .forEach((method) => {
            const hasAuthorizer = !!item.resourceMethods?.[method]?.authorizerId

            if (method === 'ANY') {
              settings.routes.push(
                { path, method: 'GET', hasAuthorizer },
                { path, method: 'PUT', hasAuthorizer },
                { path, method: 'POST', hasAuthorizer },
                { path, method: 'PATCH', hasAuthorizer },
                { path, method: 'DELETE', hasAuthorizer }
              )
            } else settings.routes.push({ path, method, hasAuthorizer })
          })
      })
      resourcesCommand.input.position = resources.position
    } while (resourcesCommand.input.position)
  }

  settings.routes.push(...config.routes)
  settings.restApiId = config.restApiId
  settings.authorizer = config.authorizer

  settings.hasInitialized = true
}

async function buildInputMock(event: any, req: http.IncomingMessage): Promise<any> {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`)

  const routes: Array<APIGatewayRoute & { pathToRegExp?: MatchResult<object> }> = settings.routes ?? []
  const route = routes.find((f, i) => {
    const fn = match(f.path.replaceAll('{', ':').replaceAll('}', ''))
    const extract = fn(url.pathname.replace('/apigateway-invoke', ''))

    if (!extract) return false
    routes[i].pathToRegExp = extract
    return f.method === req.method
  })

  if (!route) return

  const inputMock: any = {
    resource: route.path,
    path: url.pathname.replace('/apigateway-invoke', ''),
    httpMethod: route.method,
    stageVariables: null,
    headers: {
      'X-Amzn-Trace-Id': `Root=1-${randomUUID()}`,
      'X-Forwarded-For': '127.0.0.0',
      'X-Forwarded-Port': url.port,
      'X-Forwarded-Proto': 'http'
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    requestContext: {
      path: '/v1'.concat(url.pathname.replace('/apigateway-invoke', '')),
      httpMethod: route.method,
      apiId: 'xxxxxxxxxx',
      stage: 'v1',
      protocol: 'HTTP/1.1',
      requestId: randomUUID(),
      accountId: '000000000000',
      resourceId: 'xxxxxx',
      domainName: 'xxxxxxxxxx.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'xxxxxxxxxx',
      extendedRequestId: 'xxxxxxxxxxxxxxxx',
      requestTime: new Date().toISOString(),
      requestTimeEpoch: Date.now(),
      identity: {
        cognitoIdentityPoolId: null,
        cognitoIdentityId: null,
        apiKey: null,
        principalOrgId: null,
        cognitoAuthenticationType: null,
        userArn: null,
        accountId: null,
        caller: null,
        sourceIp: '127.0.0.1',
        accessKey: null,
        cognitoAuthenticationProvider: null,
        user: null,
        userAgent: req.headers['user-agent'] ?? ''
      },
      authorizer: null
    },
    body: !event || event === '' ? null : event,
    isBase64Encoded: false
  }

  Object.keys(route.pathToRegExp?.params ?? {}).forEach((k) => {
    if (inputMock.pathParameters === null) inputMock.pathParameters = {}
    inputMock.pathParameters[k] = (route.pathToRegExp?.params ?? ({} as any))[k] ?? undefined
  })

  Object.entries(req.headers).forEach(([key, value]) => {
    inputMock.headers[key] = Array.isArray(value) ? value[0] : value
  })
  Object.keys(inputMock.headers).forEach((i) => {
    inputMock.multiValueHeaders[i] = [inputMock.headers[i]]
  })

  for (const k of url.searchParams.keys()) {
    if (inputMock.queryStringParameters === null) inputMock.queryStringParameters = {}
    if (inputMock.multiValueQueryStringParameters === null) inputMock.multiValueQueryStringParameters = {}
    inputMock.queryStringParameters[k] = url.searchParams.get(k)
    inputMock.multiValueQueryStringParameters[k] = url.searchParams.getAll(k)
  }

  if (route.hasAuthorizer && settings.authorizer?.functionName) {
    const client = new LambdaClient({})
    const lambda = await client.send(
      new InvokeCommand({
        FunctionName: settings.authorizer.functionName,
        Payload: JSON.stringify(Object.assign({ type: 'REQUEST' }, inputMock))
      })
    )

    if (lambda.Payload) {
      const payload = JSON.parse(Buffer.from(lambda.Payload).toString())
      inputMock.requestContext.authorizer = payload.context
    }
  } else if (route.hasAuthorizer && settings.authorizer?.context) {
    inputMock.requestContext.authorizer = settings.authorizer.context
  } else if (route.hasAuthorizer) return

  return inputMock
}
