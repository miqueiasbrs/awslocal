import fs from 'node:fs'

export function defineConfig(): App.AppConfig {
  const { name, version, description } = JSON.parse(fs.readFileSync('./package.json', 'utf8'))
  return { name: name.replace('@capybaracode/', ''), version, description }
}
