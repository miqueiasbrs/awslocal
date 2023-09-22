# awslocal
awslocal lets you test NodeJS Amazon Lambda functions on your local machine, by providing a simplistic API and command-line tool.

It does not aim to be perfectly feature proof as projects like [serverless-offline](https://github.com/dherault/serverless-offline) or [docker-lambda](https://github.com/lambci/docker-lambda), but rather to remain very light (it still provides a fully built Context, handles all of its parameters and functions, and everything is customizable easily).

The main target are unit tests and running lambda functions locally.

**ATTENTION:** awslocal was based on [lambda-local](https://github.com/ashiina/lambda-local).

## Prerequisites
* [Node.js](https://nodejs.org/) >= 18
* [Typescript](https://www.typescriptlang.org/) >= 5
* [ts-node](https://www.npmjs.com/package/ts-node) >= 10.9.1

## Install
Global installation
```bash
npm install -g awslocal 
```
Project installation
```bash
npm install awslocal --save-dev
```

## About: CLI
### Arguments
* ```init``` - Create awslocal settings file. [more details]

* ```-i, --init``` Create awslocal settings file. [more details](#settings)
* ```-c, --config``` Path to the config file. **Default: <project>/.awslocal.json**
* ```-l, --lambda-path <path>``` Path to the lambda handler
* ```-h, --lambda-handler <handler>``` Handler name
* ```-t, --timeout <number>``` Timeout in seconds
* ```-p, --profile <profile>``` AWS profile
* ```-r, --region <region>``` AWS region
* ```-e, --env-path <path>``` Path to the .env file
* ```-E, --event-path <path>``` Path to the event file
* ```-P, --port <number>``` Port
* ```-V, --version``` Output the version number.
* ```-H, --help``` Show help.

## Settings
By default awslocal looks for the **.awslocal.json** file in the root of the project. This file contains the basic settings to emulate a lambda, apigateway proxy integration, sns, sqs and other aws services that integrate with AWS Lambda.

|Field|Type|Default|Description|
|-|-|-|-|
|lambda|object||Lambda settings|
|lambda.path|string||**Required** - Specify Lambda function file name|
|lambda.handler|string|handler|Lambda function handler name.|
|lambda.timeout|number|3|Seconds until lambda function timeout.|
|aws|object||AWS global settings|
|aws.region|string|us-east-1|Sets the AWS region.|
|port|number|9000|Starts awslocal in server mode listening to the specified port [1-65535]|
|apigateway|object||Apigateway settings|
|apigateway.restApiId|string||Obtains the configurations of resources, methods and whether authentication is required regarding the **restApiId**|
|apigateway.resources|array||This is the list of paths/resources that will be created in the future in apigateway. Note: If you have restApiId configured, the emulator combines the two resource configurations.|
|apigateway.resources[].resource|string||Resource that would be configured in the api gateway|
|apigateway.resources[].method|string||HTTP method|
|apigateway.resources[].hasAuthorizer|boolean||Informs that this endpoint requires authentication|
|apigateway.authorizer|object||It will be included in the entry that apigateway sends to the lambda|
|apigateway.authorizer.context|Map<string, string\\|number\\|boolean>||Context moke user key value, this context is disregarded if the functionName is informed|
|apigateway.authorizer.functionName|string||If you want the endpoint to be authenticated with and have the real context that apigateway sends, enter the functionName of the lambda that checks "CustomAuthorizer" access|

>.awslocal.json
```json
{
    "lambda": {
        "path": "path/to/handler",
        "handler": "handler",
        "timeout": 3,
        "env": ".env"
    },
    "aws": {
        "region": "us-east-1",
        "profile": "default"
    },
    "port": 9000,
    "apigateway": {
        "restApiId": "your-rest-api-id",
        "resources": [
            {
                "resource": "your/path/{id}",
                "method": "GET",
                "hasAuthorizer": false
            }
        ],
        "authorizer": {
            "context": {
                "yourKey": "your-value"
            },
            "functionName": "your-authorizer-function-name"
        }
    }
}
```

### tsconfig.json
Add the configuration below to your tsconfig.json
```json
{
  ...
  "ts-node": {
    "esm": true
  }
}
```


## Usage
It is possible to use awslocal via command line or via vscode debug, below are some examples of use.

### Step 1
create the .awslocal.json configuration file. To make it easier, you can use the command below.

```bash
npx awslocal --init
```

After this command, the .awslocal.json file will be created in the root of the project, with the default settings.

Remember that it is necessary to define the lambdaPath path in the created file.

### Step 2
In this step we will actually emulate AWS Lambda on our local machine. The two ways to do this, the first via the command line and the second via the vscode debug, both create a server that will wait to receive the inputs

#### Via command line
```bash
npx awslocal
```

#### Via vscode debug
To run via vscode, you need to create a .vscode/launch.json file and copy and paste the json below.

```json
{
  // Use IntelliSense to learn about possible attributes.
  // Hover to view descriptions of existing attributes.
  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debugs via awslocal",
      "skipFiles": ["<node_internals>/**"],
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/awslocal",
      "cwd": "${workspaceFolder}",
      "args": ["--config", ".awslocal.json"],
      "outputCapture": "std"
    }
  ]
}
```
After this configuration, just press F5 or the run debug button

#### Without .awslocal.json
you can emulate a lambda directly from the command line, passing the basic data. Path to the file that contains the lambda handler + path to the json file that will be the lambda input.
```bash
npx awslocal -l /path/to/lambda/file -E /path/to/test-event.json
```

### Step 3
Now use Postman or any program that can make an http call, so you can pass the input you would pass to the lambda, see the example below

```bash
curl --location 'http://localhost:9000/lambda-invoke' \
--header 'Content-Type: application/json' \
--data '{}'
```

### Examples

#### Lambda
```bash
curl --location 'http://localhost:9000/lambda-invoke' \
--header 'Content-Type: application/json' \
--data '{}'
```

#### Lambda + API Gateway proxy integration
```bash
curl --location --request PUT 'http://localhost:9000/apigateway-invoke/users/1234567489' \
--header 'Content-Type: application/json' \
--data '{
    "foo": "foo"
}'
```

#### Lambda + SNS integration
```bash
curl --location --request PUT 'http://localhost:9000/sns-invoke' \
--header 'Content-Type: application/json' \
--data '[
  {
    "subject": "Optional subject",
    "message": {
      "yourProperty": "Your data object"
    },
    "messageAttributes": {
      "yourProperty": {
        "DataType": "String",
        "StringValue": "Your data object"
      }
    }
  }
]'
```

#### Lambda + SQS integration
```bash
curl --location --request PUT 'http://localhost:9000/sqs-invoke' \
--header 'Content-Type: application/json' \
--data '[
  {
    "messageGroupId": "message-group-id",
    "messageDeduplicationId": "message-deduplication-id",
    "message": {
      "yourProperty": "Your data object"
    },
    "messageAttributes": {
      "yourProperty": {
        "dataType": "String",
        "stringValue": "Your data object",
        "stringListValues": [],
        "binaryListValues": []
      }
    }
  }
]'
```