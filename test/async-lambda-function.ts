import { APIGatewayProxyResult } from "aws-lambda"

export const handler = async (event: any, context: any): Promise<APIGatewayProxyResult> => {
    console.log('async')
    return {
        statusCode: 200,
        body: ''
    }
}