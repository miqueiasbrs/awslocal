import { readFileSync } from 'node:fs'

export function defineConfig(): AppConfig {
  const { name, version, description } = JSON.parse(readFileSync('../../package.json', 'utf-8'))
  return {
    name: name.replace('@capybaracode/', ''),
    version,
    description
  }
}
