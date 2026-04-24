import { createHash } from "node:crypto"
import { spawn } from "node:child_process"
import { access } from "node:fs/promises"
import { readdir, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import type { Hooks, Plugin } from "@opencode-ai/plugin"

import { BUILTIN_FILTERS, type BuiltinFilterSpec } from "./builtin-filters"

type PluginShell = Parameters<Plugin>[0]["$"]

type FilterSpec = {
  readonly name: string
  readonly command: string
  readonly subcommand?: string
  readonly excludeFlags: readonly string[]
  readonly requireFlags: readonly string[]
}

type PendingRewrite = {
  readonly originalCommand: string
  readonly rewrittenCommand: string
  readonly version: 1
}

type SnipRuntimeConfig = {
  readonly filterDirs: readonly string[]
  readonly enabledFilters: ReadonlyMap<string, boolean>
}

type SnipCommand = {
  readonly executable: string
}

type CommandResult = {
  readonly exitCode: number
  text(): string
}

type MessageBundle = {
  info: unknown
  parts: unknown[]
}

const SNIP_METADATA_KEY = "opencodeSnip"
const UNPROXYABLE_COMMANDS = new Set([
  "cd", "source", ".", "export", "alias", "unset", "set", "shopt", "eval", "exec",
])
const OPERATOR_RE = /(\s*(?:&&|\|\||;)\s*|\s&\s?)/
const SHELL_TOOL_IDS = new Set(["bash", "shell"])

function isShellToolID(tool: unknown): tool is string {
  return typeof tool === "string" && SHELL_TOOL_IDS.has(tool)
}

type CommandAccessor = {
  get(): string
  set(value: string): void
}

function getCommandAccessor(args: unknown): CommandAccessor | null {
  if (!args || typeof args !== "object") {
    return null
  }

  const direct = args as { command?: unknown }
  if (typeof direct.command === "string") {
    return {
      get: () => direct.command as string,
      set: (value) => {
        direct.command = value
      },
    }
  }

  const nested = args as { input?: unknown }
  if (nested.input && typeof nested.input === "object") {
    const nestedInput = nested.input as { command?: unknown }
    if (typeof nestedInput.command === "string") {
      return {
        get: () => nestedInput.command as string,
        set: (value) => {
          nestedInput.command = value
        },
      }
    }
  }

  return null
}
function normalizeFilterSpec(spec: BuiltinFilterSpec): FilterSpec
function normalizeFilterSpec(spec: Partial<FilterSpec> & Pick<FilterSpec, "name" | "command">): FilterSpec
function normalizeFilterSpec(spec: Partial<FilterSpec> & Pick<FilterSpec, "name" | "command">): FilterSpec {
  return {
    name: spec.name,
    command: spec.command,
    subcommand: spec.subcommand,
    excludeFlags: spec.excludeFlags ?? [],
    requireFlags: spec.requireFlags ?? [],
  }
}

export class SnipFilterMatcher {
  private readonly byKey = new Map<string, FilterSpec[]>()

  constructor(
    private readonly filters: readonly FilterSpec[],
    private readonly enabledFilters: ReadonlyMap<string, boolean> = new Map(),
  ) {
    for (const filter of filters) {
      const key = matcherKey(filter.command, filter.subcommand)
      const current = this.byKey.get(key)
      if (current) {
        current.push(filter)
        continue
      }

      this.byKey.set(key, [filter])
    }
  }

  match(command: string, args: readonly string[]): FilterSpec | null {
    const subcommand = args[0] ?? ""
    const filterArgs = args.length > 0 ? args.slice(1) : args

    if (subcommand) {
      const exact = this.byKey.get(matcherKey(command, subcommand))
      if (exact) {
        for (const filter of exact) {
          if (matchesFlags(filter, filterArgs)) {
            return filter
          }
        }
      }
    }

    const broad = this.byKey.get(matcherKey(command))
    if (!broad) {
      return null
    }

    for (const filter of broad) {
      if (matchesFlags(filter, filterArgs)) {
        return filter
      }
    }

    return null
  }

  isEnabled(name: string): boolean {
    return this.enabledFilters.get(name) !== false
  }
}

function matcherKey(command: string, subcommand?: string): string {
  return subcommand ? `${command}:${subcommand}` : command
}

function matchesFlags(filter: FilterSpec, args: readonly string[]): boolean {
  for (const excludeFlag of filter.excludeFlags) {
    if (args.some((arg) => arg.startsWith(excludeFlag))) {
      return false
    }
  }

  for (const requireFlag of filter.requireFlags) {
    if (!args.some((arg) => arg.startsWith(requireFlag))) {
      return false
    }
  }

  return true
}

export function createSnipMatcher(
  filters: readonly (BuiltinFilterSpec | FilterSpec)[],
  enabledFilters: ReadonlyMap<string, boolean> = new Map(),
): SnipFilterMatcher {
  return new SnipFilterMatcher(filters.map(normalizeFilterSpec), enabledFilters)
}

export function parseSnipConfigOutput(output: string): SnipRuntimeConfig {
  const enabledFilters = new Map<string, boolean>()
  let filterDirs: string[] = []

  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("filters.dir:")) {
      const value = line.slice("filters.dir:".length).trim()
      filterDirs = value ? value.split(/,\s+/).filter(Boolean) : []
      continue
    }

    if (!line.startsWith("filters.enable.")) {
      continue
    }

    const separator = line.indexOf(":")
    if (separator === -1) {
      continue
    }

    const name = line.slice("filters.enable.".length, separator).trim()
    const rawValue = line.slice(separator + 1).trim()
    if (!name) {
      continue
    }

    enabledFilters.set(name, rawValue === "true")
  }

  return { filterDirs, enabledFilters }
}

async function loadSnipRuntimeConfig($: PluginShell | undefined): Promise<SnipRuntimeConfig> {
  const command = await resolveSnipCommand($)
  const result = await runCommand($, command.executable, ["config"])
  if (result.exitCode !== 0) {
    return { filterDirs: [], enabledFilters: new Map() }
  }

  return parseSnipConfigOutput(result.text())
}

export async function runCommand(
  $: PluginShell | undefined,
  executable: string,
  args: readonly string[],
): Promise<CommandResult> {
  if ($) {
    const command = [executable, ...args].map((part) => $.escape(part)).join(" ")
    return await $`${{ raw: command }}`.quiet().nothrow()
  }

  return await new Promise((resolve) => {
    let stdout = ""
    let settled = false
    const finish = (result: CommandResult) => {
      if (settled) {
        return
      }

      settled = true
      resolve(result)
    }

    const child = spawn(executable, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    })

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString()
    })

    child.on("error", () => {
      finish({
        exitCode: 1,
        text: () => stdout,
      })
    })

    child.on("close", (code) => {
      finish({
        exitCode: code ?? 1,
        text: () => stdout,
      })
    })
  })
}

async function resolveSnipCommand($: PluginShell | undefined): Promise<SnipCommand> {
  const candidates = new Set<string>([
    "snip",
    path.join(os.homedir(), "go", "bin", process.platform === "win32" ? "snip.exe" : "snip"),
    path.join(os.homedir(), "bin", process.platform === "win32" ? "snip.exe" : "snip"),
  ])

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA
    if (localAppData) {
      candidates.add(path.join(localAppData, "Microsoft", "WinGet", "Links", "snip.exe"))
    }

    const userProfile = process.env.USERPROFILE
    if (userProfile) {
      candidates.add(path.join(userProfile, "scoop", "shims", "snip.exe"))
    }
  }

  for (const candidate of candidates) {
    if (path.isAbsolute(candidate)) {
      try {
        await access(candidate)
      } catch {
        continue
      }
    }

    const result = await runCommand($, candidate, ["--version"])
    if (result.exitCode === 0) {
      return { executable: candidate }
    }
  }

  return { executable: "snip" }
}

function isYAMLFile(name: string): boolean {
  return name.endsWith(".yaml") || name.endsWith(".yml")
}

function normalizePathKey(filePath: string): string {
  const resolved = path.resolve(filePath)
  return process.platform === "win32" ? resolved.toLowerCase() : resolved
}

function isGlobalFilterDir(dir: string): boolean {
  const globalPrefix = `${normalizePathKey(path.join(os.homedir(), ".config", "snip"))}${path.sep}`
  const candidate = `${normalizePathKey(dir)}${path.sep}`
  return candidate.startsWith(globalPrefix)
}

async function loadTrustStore(): Promise<Map<string, string>> {
  const trustStorePath = path.join(os.homedir(), ".config", "snip", "trusted.json")

  try {
    const raw = await readFile(trustStorePath, "utf8")
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") {
      return new Map()
    }

    return new Map(
      Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
        .map(([filePath, hash]) => [normalizePathKey(filePath), hash]),
    )
  } catch (error) {
    if (isMissingFileError(error)) {
      return new Map()
    }

    console.warn(`[snip] failed to load trust store: ${String(error)}`)
    return new Map()
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
}

async function isTrustedFilterFile(filePath: string, trustStore: ReadonlyMap<string, string>): Promise<boolean> {
  const expectedHash = trustStore.get(normalizePathKey(filePath))
  if (!expectedHash) {
    return false
  }

  try {
    const content = await readFile(filePath)
    const actualHash = createHash("sha256").update(content).digest("hex")
    return actualHash === expectedHash
  } catch {
    return false
  }
}

async function loadUserFilterSpecs(filterDirs: readonly string[]): Promise<FilterSpec[]> {
  const trustStore = await loadTrustStore()
  const specs: FilterSpec[] = []

  for (const filterDir of filterDirs) {
    let entries

    try {
      entries = await readdir(filterDir, { withFileTypes: true })
    } catch (error) {
      if (!isMissingFileError(error)) {
        console.warn(`[snip] failed to read filter dir ${filterDir}: ${String(error)}`)
      }
      continue
    }

    entries.sort((left, right) => left.name.localeCompare(right.name))
    const trustedDir = isGlobalFilterDir(filterDir)

    for (const entry of entries) {
      if (!entry.isFile() || !isYAMLFile(entry.name)) {
        continue
      }

      const filePath = path.join(filterDir, entry.name)
      if (!trustedDir && !(await isTrustedFilterFile(filePath, trustStore))) {
        continue
      }

      try {
        const spec = parseFilterSpec(await readFile(filePath, "utf8"))
        specs.push(spec)
      } catch (error) {
        console.warn(`[snip] skipping invalid filter ${filePath}: ${String(error)}`)
      }
    }
  }

  return specs
}

function stripComment(line: string): string {
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

function parseScalar(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

function parseInlineArray(value: string): string[] {
  const inner = value.trim().replace(/^\[/, "").replace(/\]$/, "").trim()
  if (!inner) {
    return []
  }

  return inner.split(",").map((item) => parseScalar(item)).filter(Boolean)
}

export function parseFilterSpec(text: string): FilterSpec {
  const spec = {
    name: "",
    command: "",
    subcommand: undefined as string | undefined,
    excludeFlags: [] as string[],
    requireFlags: [] as string[],
  }

  let section = ""
  let pendingList: "excludeFlags" | "requireFlags" | undefined

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine)
    if (!line.trim()) {
      continue
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0
    const trimmed = line.trim()

    if (indent === 0) {
      pendingList = undefined

      if (!trimmed.includes(":")) {
        continue
      }

      const separator = trimmed.indexOf(":")
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1)
      section = key

      if (key === "name") {
        spec.name = parseScalar(value)
      }

      continue
    }

    if (section !== "match") {
      continue
    }

    if (indent === 2 && trimmed.includes(":")) {
      const separator = trimmed.indexOf(":")
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim()
      pendingList = undefined

      if (key === "command") {
        spec.command = parseScalar(value)
        continue
      }

      if (key === "subcommand") {
        const parsed = parseScalar(value)
        spec.subcommand = parsed || undefined
        continue
      }

      if (key === "exclude_flags") {
        if (value.startsWith("[")) spec.excludeFlags = parseInlineArray(value)
        else if (!value) pendingList = "excludeFlags"
        continue
      }

      if (key === "require_flags") {
        if (value.startsWith("[")) spec.requireFlags = parseInlineArray(value)
        else if (!value) pendingList = "requireFlags"
      }

      continue
    }

    if (indent >= 4 && pendingList && trimmed.startsWith("- ")) {
      spec[pendingList].push(parseScalar(trimmed.slice(2)))
    }
  }

  if (!spec.name || !spec.command) {
    throw new Error("missing required name or match.command")
  }

  return spec
}

async function loadSnipMatcher($: PluginShell | undefined): Promise<SnipFilterMatcher> {
  const runtimeConfig = await loadSnipRuntimeConfig($)
  const merged = BUILTIN_FILTERS.map(normalizeFilterSpec)
  const filterIndex = new Map(merged.map((filter, index) => [filter.name, index]))
  const userFilters = await loadUserFilterSpecs(runtimeConfig.filterDirs)

  for (const filter of userFilters) {
    const existingIndex = filterIndex.get(filter.name)
    if (existingIndex !== undefined) {
      merged[existingIndex] = filter
      continue
    }

    filterIndex.set(filter.name, merged.length)
    merged.push(filter)
  }

  return new SnipFilterMatcher(merged, runtimeConfig.enabledFilters)
}

function findFirstPipe(command: string): number {
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaped = false

  for (let i = 0; i < command.length; i++) {
    const char = command[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === "\\" && !inSingleQuote) {
      escaped = true
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (char === "|" && !inSingleQuote && !inDoubleQuote) {
      if (command[i + 1] === "|" || (i > 0 && command[i - 1] === "|")) {
        continue
      }

      return i
    }
  }

  return -1
}

function parseSegment(segment: string): { prefix: string; envVars: string; bareCommand: string } {
  const trimmedStart = segment.trimStart()
  const prefix = segment.slice(0, segment.length - trimmedStart.length)
  const core = trimmedStart.trimEnd()
  const suffix = trimmedStart.slice(core.length)

  let rest = core
  const envParts: string[] = []

  while (rest) {
    const equalsIndex = rest.indexOf("=")
    if (equalsIndex <= 0) {
      break
    }

    const name = rest.slice(0, equalsIndex)
    if (!isEnvVarName(name)) {
      break
    }

    const valueStart = equalsIndex + 1
    const valueEnd = findEnvValueEnd(rest.slice(valueStart))
    const assignment = rest.slice(0, valueStart + valueEnd)
    const afterAssignment = rest.slice(valueStart + valueEnd)
    if (!afterAssignment || !/^\s/.test(afterAssignment)) {
      break
    }

    envParts.push(assignment)
    rest = afterAssignment.trimStart()
  }

  const envVars = envParts.length > 0 ? `${envParts.join(" ")} ` : ""
  return {
    prefix,
    envVars,
    bareCommand: `${rest}${suffix}`,
  }
}

function isEnvVarName(value: string): boolean {
  if (!value) {
    return false
  }

  for (let i = 0; i < value.length; i++) {
    const char = value[i]

    if (i === 0) {
      if (!(/[A-Za-z_]/.test(char))) {
        return false
      }
      continue
    }

    if (!(/[A-Za-z0-9_]/.test(char))) {
      return false
    }
  }

  return true
}

function findEnvValueEnd(value: string): number {
  if (!value) {
    return 0
  }

  if (value[0] === '"' || value[0] === "'") {
    const quote = value[0]
    for (let i = 1; i < value.length; i++) {
      if (quote === '"' && value[i] === "\\" && i + 1 < value.length) {
        i++
        continue
      }

      if (value[i] === quote) {
        return i + 1
      }
    }

    return value.length
  }

  for (let i = 0; i < value.length; i++) {
    if (/\s/.test(value[i])) {
      return i
    }
  }

  return value.length
}

function tokenizeShellCommand(command: string): string[] {
  const tokens: string[] = []
  let current = ""
  let quote: "'" | '"' | undefined
  let escaped = false

  for (let i = 0; i < command.length; i++) {
    const char = command[i]

    if (quote === "'") {
      if (char === "'") {
        quote = undefined
      } else {
        current += char
      }
      continue
    }

    if (quote === '"') {
      if (escaped) {
        current += char
        escaped = false
        continue
      }

      if (char === "\\") {
        escaped = true
        continue
      }

      if (char === '"') {
        quote = undefined
      } else {
        current += char
      }
      continue
    }

    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === "\\") {
      const next = command[i + 1]
      if (next && (/\s/.test(next) || next === "'" || next === '"' || next === "\\")) {
        escaped = true
        continue
      }

      current += char
      continue
    }

    if (char === "'" || char === '"') {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current)
        current = ""
      }
      continue
    }

    current += char
  }

  if (escaped) {
    current += "\\"
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

function executableName(token: string): string {
  return path.win32.basename(path.posix.basename(token)).toLowerCase()
}

function isSnipExecutable(token: string): boolean {
  const name = executableName(token)
  return name === "snip" || name === "snip.exe"
}

function rewriteSegment(segment: string, matcher: SnipFilterMatcher): string {
  const { prefix, envVars, bareCommand } = parseSegment(segment)
  if (!bareCommand.trim()) {
    return segment
  }

  const tokens = tokenizeShellCommand(bareCommand)
  if (tokens.length === 0) {
    return segment
  }

  const command = tokens[0]
  if (isSnipExecutable(command) || UNPROXYABLE_COMMANDS.has(command)) {
    return segment
  }

  const matchedFilter = matcher.match(command, tokens.slice(1))
  if (!matchedFilter || !matcher.isEnabled(matchedFilter.name)) {
    return segment
  }

  return `${prefix}${envVars}snip ${bareCommand}`
}

function rewriteChainedCommand(command: string, matcher: SnipFilterMatcher): string {
  const segments = command.split(OPERATOR_RE)
  return segments
    .map((segment) => (OPERATOR_RE.test(segment) ? segment : rewriteSegment(segment, matcher)))
    .join("")
}

export function rewriteCommand(command: string, matcher: SnipFilterMatcher): string {
  const pipeIndex = findFirstPipe(command)
  if (pipeIndex === -1) {
    return rewriteChainedCommand(command, matcher)
  }

  return `${rewriteChainedCommand(command.slice(0, pipeIndex), matcher)}${command.slice(pipeIndex)}`
}

function callKey(sessionID: string, callID: string): string {
  return `${sessionID}:${callID}`
}

export function createToolExecuteBefore(
  matcher: SnipFilterMatcher,
  pendingRewrites: Map<string, PendingRewrite>,
): NonNullable<Hooks["tool.execute.before"]> {
  return async (input, output) => {
    if (!isShellToolID(input.tool)) {
      return
    }

    const accessor = getCommandAccessor(output.args)
    if (!accessor) {
      return
    }

    const command = accessor.get()
    if (!command || typeof command !== "string") {
      return
    }

    const rewrittenCommand = rewriteCommand(command, matcher)
    accessor.set(rewrittenCommand)

    const key = callKey(input.sessionID, input.callID)
    if (rewrittenCommand === command) {
      pendingRewrites.delete(key)
      return
    }

    pendingRewrites.set(key, {
      originalCommand: command,
      rewrittenCommand,
      version: 1,
    })
  }
}

export function createToolExecuteAfter(
  pendingRewrites: Map<string, PendingRewrite>,
): NonNullable<Hooks["tool.execute.after"]> {
  return async (input, output) => {
    if (!isShellToolID(input.tool)) {
      return
    }

    const key = callKey(input.sessionID, input.callID)
    const rewrite = pendingRewrites.get(key)
    pendingRewrites.delete(key)
    if (!rewrite) {
      return
    }

    const metadata = output.metadata && typeof output.metadata === "object"
      ? { ...output.metadata as Record<string, unknown> }
      : {}

    metadata[SNIP_METADATA_KEY] = rewrite
    output.metadata = metadata
  }
}

function getSnipMetadata(part: unknown): PendingRewrite | null {
  if (!part || typeof part !== "object") {
    return null
  }

  const metadataCandidates: unknown[] = []
  if ("metadata" in part) {
    metadataCandidates.push((part as { metadata?: unknown }).metadata)
  }

  const state = "state" in part ? (part as { state?: unknown }).state : undefined
  if (state && typeof state === "object" && "metadata" in state) {
    metadataCandidates.push((state as { metadata?: unknown }).metadata)
  }

  for (const metadata of metadataCandidates) {
    if (!metadata || typeof metadata !== "object") {
      continue
    }

    const snipMetadata = (metadata as Record<string, unknown>)[SNIP_METADATA_KEY]
    if (!snipMetadata || typeof snipMetadata !== "object") {
      continue
    }

    const originalCommand = (snipMetadata as Record<string, unknown>).originalCommand
    const rewrittenCommand = (snipMetadata as Record<string, unknown>).rewrittenCommand
    if (typeof originalCommand !== "string" || typeof rewrittenCommand !== "string") {
      continue
    }

    return {
      originalCommand,
      rewrittenCommand,
      version: 1,
    }
  }

  return null
}

function sanitizeToolPartForModel(part: unknown): void {
  if (!part || typeof part !== "object") {
    return
  }

  const type = "type" in part ? (part as { type?: unknown }).type : undefined
  if (type !== "tool") {
    return
  }

  const metadata = getSnipMetadata(part)
  if (!metadata) {
    return
  }

  const state = (part as { state?: unknown }).state
  if (!state || typeof state !== "object" || !("input" in state)) {
    return
  }

  const input = (state as { input?: unknown }).input
  if (!input || typeof input !== "object") {
    return
  }

  const command = (input as { command?: unknown }).command
  if (typeof command === "string") {
    ;(input as { command: string }).command = metadata.originalCommand
  }
}

export function sanitizeMessagesForModel(messages: MessageBundle[]): void {
  for (const message of messages) {
    for (const part of message.parts) {
      sanitizeToolPartForModel(part)
    }
  }
}

export const experimentalChatMessagesTransform: NonNullable<Hooks["experimental.chat.messages.transform"]> = async (_input, output) => {
  sanitizeMessagesForModel(output.messages as MessageBundle[])
}

export const SnipPlugin: Plugin = async ({ $ }) => {
  const snipCommand = await resolveSnipCommand($)
  const snipVersion = await runCommand($, snipCommand.executable, ["--version"])
  if (snipVersion.exitCode !== 0) {
    console.warn("[snip] snip binary not found in PATH - plugin disabled")
    return {}
  }

  let matcher = createSnipMatcher(BUILTIN_FILTERS)

  try {
    matcher = await loadSnipMatcher($)
  } catch (error) {
    console.warn(`[snip] failed to load runtime filters, using built-ins only: ${String(error)}`)
  }

  const pendingRewrites = new Map<string, PendingRewrite>()

  return {
    "tool.execute.before": createToolExecuteBefore(matcher, pendingRewrites),
    "tool.execute.after": createToolExecuteAfter(pendingRewrites),
    "experimental.chat.messages.transform": experimentalChatMessagesTransform,
  }
}

export default {
  id: "opencode-snip-fork",
  server: SnipPlugin,
}
