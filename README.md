# awslocal
awslocal lets you test NodeJS Amazon Lambda functions on your local machine, by providing a simplistic API and command-line tool.

It does not aim to be perfectly feature proof as projects like [serverless-offline](https://github.com/dherault/serverless-offline) or [docker-lambda](https://github.com/lambci/docker-lambda), but rather to remain very light (it still provides a fully built Context, handles all of its parameters and functions, and everything is customizable easily).

The main target are unit tests and running lambda functions locally.

**ATTENTION:** awslocal was based on [lambda-local](https://github.com/ashiina/lambda-local).

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
* ```-i, --init``` Create awslocal settings file. [more details]
* ```-c, --config``` Path to the config file. **Default: <project>/.awslocal.json**
* ```-V, --version``` Output the version number.
* ```-H, --help``` Show help.

## Settings
By default awslocal looks for the **.awslocal.json** file in the root of the project. This file contains the basic settings to emulate a lambda, apigateway proxy integration, sns, sqs and other aws services that integrate with AWS Lambda.

```json
{
  "lambdaPath": "path/to/handler", // [Required] Specify Lambda function file name
  "handler": "handler", // Lambda function handler name. [Default: "handler"]
  "timeout": 3, // Seconds until lambda function timeout. [Default: 3]
  "profile": "default", // Read the AWS profile of the file. [Default: default]
  "region": "us-east-1", // Sets the AWS region. [Default: us-east-1]
  "envPath": ".env", // Set extra environment variables from an env file. [Default: .env]
  "port": 9000, // Set server port [Default: 9000]
  "apigateway": { // Use this part to configure the apigateway emulator
    "restApiId": "your-rest-api-id", // If you enter the restApiId of your real apigateway, the emulator searches its list of resources to configure the paths
    "routes": [ // This is the list of paths/resources that will be created in the future in apigateway. Note: If you have restApiId configured, the emulator combines the two resource configurations.
      {
        "path": "your/path/{id}", // resource that would be configured in the api gateway
        "method": "GET", // HTTP method
        "hasAuthorizer": false // Informs that this endpoint requires authentication
      }
    ],
    "authorizer": { // It will be included in the entry that apigateway sends to the lambda
      "context": { // Context moke user key value, this context is disregarded if the functionName is informed
        "yourKey": "your-value"
      },
      "functionName": "'your-authorizer-function-name" // If you want the endpoint to be authenticated with and have the real context that apigateway sends, enter the functionName of the lambda that checks "CustomAuthorizer" access
    }
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