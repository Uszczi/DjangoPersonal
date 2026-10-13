import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const generatedDirectory = fileURLToPath(new URL('../src/generated/api/', import.meta.url))

async function markGeneratedFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })

  await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await markGeneratedFiles(path)
      return
    }

    if (!entry.name.endsWith('.ts')) return

    const content = await readFile(path, 'utf8')
    if (!content.startsWith('// @ts-nocheck')) {
      await writeFile(path, `// @ts-nocheck\n${content}`)
    }
  }))
}

await markGeneratedFiles(generatedDirectory)
