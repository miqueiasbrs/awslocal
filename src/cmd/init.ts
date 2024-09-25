import { Command } from 'commander'

import { init } from '../core/awslocal.js'

export default new Command('init').description('Create awslocal settings file').action(() => {
  init()
})
