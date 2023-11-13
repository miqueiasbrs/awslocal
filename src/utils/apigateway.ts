import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import { match, type MatchResult } from 'path-to-regexp'
import { v4 } from 'uuid'

import type http from 'http'

export async function buildInputMock(
  event: any,
  req: http.IncomingMessage,
  settings: App.AWSLocal.APIGateway
): Promise<App.AWS.ApiGateway.Request | undefined> {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`)

  const routes: Array<App.AWSLocal.APIGatewayRoute & { pathToRegExp?: MatchResult<object> }> = settings.resources ?? []
  const route = routes.find((f, i) => {
    const fn = match(f.resource.replaceAll('{', ':').replaceAll('}', ''))
    const extract = fn(url.pathname.replace('/apigateway-invoke', ''))

    if (!extract) return false
    routes[i].pathToRegExp = extract
    return f.method === req.method
  })

  if (!route) return

  const inputMock: App.AWS.ApiGateway.Request = {
    resource: route.resource,
    path: url.pathname.replace('/apigateway-invoke', ''),
    httpMethod: route.method as App.AWS.ApiGateway.HttpMethod,
    stageVariables: null,
    headers: {
      'X-Amzn-Trace-Id': `Root=1-${v4()}`,
      'X-Forwarded-For': '127.0.0.1',
      'X-Forwarded-Port': url.port,
      'X-Forwarded-Proto': 'http'
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    requestContext: {
      path: '/v1'.concat(url.pathname.replace('/apigateway-invoke', '')),
      resourcePath: '/v1'.concat(url.pathname.replace('/apigateway-invoke', '')),
      httpMethod: route.method as App.AWS.ApiGateway.HttpMethod,
      apiId: 'xxxxxxxxxx',
      stage: 'v1',
      protocol: 'HTTP/1.1',
      requestId: v4(),
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
    inputMock.headers[key] = Array.isArray(value) ? value[0] : (value as string)
  })

  Object.keys(inputMock.headers).forEach((i) => {
    inputMock.multiValueHeaders[i] = [inputMock.headers[i]]
  })

  for (const k of url.searchParams.keys()) {
    if (inputMock.queryStringParameters === null) inputMock.queryStringParameters = {}
    if (inputMock.multiValueQueryStringParameters === null) inputMock.multiValueQueryStringParameters = {}
    inputMock.queryStringParameters[k] = url.searchParams.get(k) as string
    inputMock.multiValueQueryStringParameters[k] = url.searchParams.getAll(k)
  }

  if (route.hasAuthorizer && settings.authorizer?.functionName) {
    const client = new LambdaClient({})
    const lambda = await client.send(
      new InvokeCommand({
        FunctionName: settings.authorizer?.functionName,
        Payload: JSON.stringify(Object.assign({ type: 'REQUEST' }, inputMock))
      })
    )

    if (lambda.Payload) {
      const payload = JSON.parse(Buffer.from(lambda.Payload).toString())
      inputMock.requestContext.authorizer = payload.context
    }
  } else if (route.hasAuthorizer && settings.authorizer?.context) {
    inputMock.requestContext.authorizer = settings.authorizer?.context
  } else if (route.hasAuthorizer) return

  return inputMock
}
