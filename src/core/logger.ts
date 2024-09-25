import chalk from 'chalk'

export default {
  info: (...args: any[]) => console.log(chalk.green('[awslocal]', ...args)),
  warn: (...args: any[]) => console.log(chalk.yellow('[awslocal]', ...args)),
  error: (...args: any[]) => console.log(chalk.red('[awslocal]', ...args))
}
