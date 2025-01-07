export const handler = (event: any, context: any, callback: any) => {
    console.log('callback', event, context)
    callback(true)
}