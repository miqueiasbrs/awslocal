import { readFileSync } from 'fs'

export function defineConfig(): App.AppConfig {
  const { name, version, description } = JSON.parse(readFileSync('./package.json', 'utf8'))
  return { name: name.replace('@capybaracode/', ''), version, description }
}
