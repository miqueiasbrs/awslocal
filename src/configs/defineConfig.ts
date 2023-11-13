import fs from 'fs'

export function defineConfig(): App.Config {
  const { name, version, description } = Object.freeze(JSON.parse(fs.readFileSync('./package.json', 'utf8')))
  return {
    name,
    version,
    description,
    logLevel: 'info'
  }
}
