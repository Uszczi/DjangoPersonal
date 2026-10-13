import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const generatedDirectory = fileURLToPath(new URL('../src/generated/api/', import.meta.url))

async function postProcessGeneratedFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })

  await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await postProcessGeneratedFiles(path)
      return
    }

    const isTypeScript = entry.name.endsWith('.ts')
    const isMarkdown = entry.name.endsWith('.md')
    if (!isTypeScript && !isMarkdown) return

    const content = await readFile(path, 'utf8')
    const trimmedContent = content.replace(/[ \t]+$/gm, '')
    const processedContent = isTypeScript && !trimmedContent.startsWith('// @ts-nocheck')
      ? `// @ts-nocheck\n${trimmedContent}`
      : trimmedContent

    if (processedContent !== content) await writeFile(path, processedContent)
  }))
}

await postProcessGeneratedFiles(generatedDirectory)
