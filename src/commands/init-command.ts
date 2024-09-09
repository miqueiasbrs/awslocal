import fs from 'node:fs'

import { Command } from 'commander'

import { DEFAULT_AWS_LOCAL_CONFIG } from '../awslocal.js'

export default new Command('init').description('Create awslocal settings file').action(() => {
  fs.writeFileSync('.awslocal.json', JSON.stringify(DEFAULT_AWS_LOCAL_CONFIG, null, 2))
})
