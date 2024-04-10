const RED_COLOR = '\x1b[31m'
const GREEN_COLOR = '\x1b[32m'
const YELLOW_COLOR = '\x1b[33m'
const RESET_COLOR = '\x1b[0m'

export default {
  info: (...args: any[]) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    console.log(''.concat(GREEN_COLOR, 'info:', RESET_COLOR), ...args, RESET_COLOR)
  },
  warn: (...args: any[]) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    console.log(''.concat(YELLOW_COLOR, 'warn:', RESET_COLOR), ...args, RESET_COLOR)
  },
  error: (...args: any[]) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    console.log(''.concat(RED_COLOR, 'error:', RESET_COLOR), ...args, RESET_COLOR)
  },
  system: {
    info: (...args: any[]) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      console.log(''.concat(GREEN_COLOR, '[awslocal]'), ...args, RESET_COLOR)
    },
    warn: (...args: any[]) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      console.log(''.concat(YELLOW_COLOR, '[awslocal]'), ...args, RESET_COLOR)
    },
    error: (...args: any[]) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      console.log(''.concat(RED_COLOR, '[awslocal]'), ...args, RESET_COLOR)
    }
  }
}
