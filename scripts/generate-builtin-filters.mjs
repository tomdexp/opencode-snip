import { writeFile } from "node:fs/promises"

const FILTERS_URL = "https://api.github.com/repos/edouard-claude/snip/contents/filters"

function parseScalar(value) {
  const trimmed = value.trim()
  if (!trimmed) return ""

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

function stripComment(line) {
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (char === "#" && !inSingleQuote && !inDoubleQuote) {
      return line.slice(0, i)
    }
  }

  return line
}

function parseInlineArray(value) {
  const inner = value.trim().replace(/^\[/, "").replace(/\]$/, "").trim()
  if (!inner) return []

  return inner
    .split(",")
    .map((item) => parseScalar(item))
    .filter(Boolean)
}

function parseFilter(text) {
  const filter = {
    name: "",
    command: "",
    subcommand: undefined,
    excludeFlags: [],
    requireFlags: [],
  }

  let section = ""
  let pendingList = undefined

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine)
    if (!line.trim()) continue

    const indent = line.match(/^\s*/)[0].length
    const trimmed = line.trim()

    if (indent === 0) {
      pendingList = undefined

      if (!trimmed.includes(":")) continue
      const separator = trimmed.indexOf(":")
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1)
      section = key

      if (key === "name") {
        filter.name = parseScalar(value)
      }

      continue
    }

    if (section !== "match") continue

    if (indent === 2 && trimmed.includes(":")) {
      const separator = trimmed.indexOf(":")
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim()
      pendingList = undefined

      if (key === "command") {
        filter.command = parseScalar(value)
        continue
      }

      if (key === "subcommand") {
        const parsed = parseScalar(value)
        filter.subcommand = parsed || undefined
        continue
      }

      if (key === "exclude_flags") {
        if (value.startsWith("[")) filter.excludeFlags = parseInlineArray(value)
        else if (!value) pendingList = "excludeFlags"
        continue
      }

      if (key === "require_flags") {
        if (value.startsWith("[")) filter.requireFlags = parseInlineArray(value)
        else if (!value) pendingList = "requireFlags"
      }

      continue
    }

    if (indent >= 4 && pendingList && trimmed.startsWith("- ")) {
      filter[pendingList].push(parseScalar(trimmed.slice(2)))
    }
  }

  if (!filter.name || !filter.command) {
    throw new Error("Invalid filter definition")
  }

  return filter
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "opencode-snip-generator" },
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

async function main() {
  const files = await fetchJson(FILTERS_URL)
  const specs = []

  for (const file of files) {
    if (!file.download_url) continue
    if (!(file.name.endsWith(".yaml") || file.name.endsWith(".yml"))) continue

    const response = await fetch(file.download_url, {
      headers: { "User-Agent": "opencode-snip-generator" },
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch ${file.name}: ${response.status}`)
    }

    specs.push(parseFilter(await response.text()))
  }

  specs.sort((left, right) => left.name.localeCompare(right.name))

  const source = `export type BuiltinFilterSpec = {\n  readonly name: string\n  readonly command: string\n  readonly subcommand?: string\n  readonly excludeFlags?: readonly string[]\n  readonly requireFlags?: readonly string[]\n}\n\n// Generated from edouard-claude/snip built-in filters.\nexport const BUILTIN_FILTERS: readonly BuiltinFilterSpec[] = ${JSON.stringify(specs, null, 2).replace(/\"([^\"]+)\":/g, "$1:")} as const\n`

  await writeFile("src/builtin-filters.ts", source, "utf8")
  console.log(`Wrote src/builtin-filters.ts with ${specs.length} filters`)
}

await main()
