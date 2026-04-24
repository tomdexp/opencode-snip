import { beforeEach, describe, expect, it } from "vitest"

import {
  SnipPlugin,
  createSnipMatcher,
  createToolExecuteAfter,
  createToolExecuteBefore,
  parseFilterSpec,
  parseSnipConfigOutput,
  rewriteCommand,
  runCommand,
  sanitizeMessagesForModel,
} from "./index"

describe("parseFilterSpec", () => {
  it("parses command, subcommand, and flag constraints", () => {
    const filter = parseFilterSpec(`
name: "go-test"
version: 1

match:
  command: "go"
  subcommand: "test"
  exclude_flags: ["-json", "-v"]
  require_flags:
    - "-run"
`)

    expect(filter).toEqual({
      name: "go-test",
      command: "go",
      subcommand: "test",
      excludeFlags: ["-json", "-v"],
      requireFlags: ["-run"],
    })
  })
})

describe("parseSnipConfigOutput", () => {
  it("parses filter directories and enabled filters", () => {
    const config = parseSnipConfigOutput([
      "filters.dir: C:/Users/test/.config/snip/filters, Z:/repo/.snip/filters",
      "filters.enable.go-test: true",
      "filters.enable.git-log: false",
    ].join("\n"))

    expect(config.filterDirs).toEqual([
      "C:/Users/test/.config/snip/filters",
      "Z:/repo/.snip/filters",
    ])
    expect(config.enabledFilters.get("go-test")).toBe(true)
    expect(config.enabledFilters.get("git-log")).toBe(false)
  })
})

describe("runCommand", () => {
  it("supports Node runtime without Bun shell", async () => {
    const result = await runCommand(undefined, process.execPath, ["-e", "process.stdout.write('ok')"])

    expect(result.exitCode).toBe(0)
    expect(result.text()).toBe("ok")
  })

  it("reports non-zero exit when executable is missing", async () => {
    const result = await runCommand(undefined, "__definitely_missing_snip_binary__", ["--version"])

    expect(result.exitCode).not.toBe(0)
  })
})

describe("SnipPlugin", () => {
  it("initializes without Bun shell in Desktop-like runtimes", async () => {
    const hooks = await SnipPlugin({
      client: {} as never,
      project: {} as never,
      directory: "Z:/Projects/LISS",
      worktree: "Z:/Projects/LISS",
      experimental_workspace: { register() {} } as never,
      serverUrl: new URL("http://localhost:4096"),
      $: undefined as never,
    } as never)

    expect(hooks).toMatchObject({
      "tool.execute.before": expect.any(Function),
      "tool.execute.after": expect.any(Function),
      "experimental.chat.messages.transform": expect.any(Function),
    })
  })
})

describe("rewriteCommand", () => {
  const matcher = createSnipMatcher([
    {
      name: "go-test",
      command: "go",
      subcommand: "test",
      excludeFlags: ["-json", "-v", "-bench", "-run"],
    },
    {
      name: "go-build",
      command: "go",
      subcommand: "build",
    },
    {
      name: "dotnet-test",
      command: "dotnet",
      subcommand: "test",
    },
    {
      name: "git-log",
      command: "git",
      subcommand: "log",
      excludeFlags: ["--format", "--pretty", "--oneline"],
    },
    {
      name: "npm-install",
      command: "npm",
      requireFlags: ["--json"],
    },
    {
      name: "ls",
      command: "ls",
    },
  ])

  it("rewrites matching simple commands", () => {
    expect(rewriteCommand("go test ./...", matcher)).toBe("snip go test ./...")
  })

  it("preserves env prefixes when rewriting", () => {
    expect(rewriteCommand("CGO_ENABLED=0 GOOS=linux go test ./...", matcher))
      .toBe("CGO_ENABLED=0 GOOS=linux snip go test ./...")
  })

  it("only rewrites commands with an actual matching filter", () => {
    expect(rewriteCommand("dotnet restore", matcher)).toBe("dotnet restore")
    expect(rewriteCommand("git status", matcher)).toBe("git status")
  })

  it("respects exclude_flags", () => {
    expect(rewriteCommand("go test -v ./...", matcher)).toBe("go test -v ./...")
    expect(rewriteCommand("git log --oneline", matcher)).toBe("git log --oneline")
  })

  it("respects require_flags", () => {
    expect(rewriteCommand("npm install", matcher)).toBe("npm install")
    expect(rewriteCommand("npm install --json", matcher)).toBe("snip npm install --json")
  })

  it("rewrites chained matching commands segment by segment", () => {
    expect(rewriteCommand("go test && go build", matcher))
      .toBe("snip go test && snip go build")
  })

  it("does not rewrite chained non-matching commands", () => {
    expect(rewriteCommand("cd /tmp && dotnet restore && ls", matcher))
      .toBe("cd /tmp && dotnet restore && snip ls")
  })

  it("only rewrites the command before a pipe", () => {
    expect(rewriteCommand("git log | head", matcher)).toBe("snip git log | head")
  })

  it("does not split pipes inside quotes", () => {
    expect(rewriteCommand('echo "hello | world" | cat', matcher))
      .toBe('echo "hello | world" | cat')
  })

  it("leaves explicit snip commands untouched", () => {
    expect(rewriteCommand("snip dotnet test", matcher)).toBe("snip dotnet test")
  })

  it("handles Windows activation repro without prepending snip", () => {
    expect(rewriteCommand('.venv\\Scripts\\activate && pip install "xinference[all]"', matcher))
      .toBe('.venv\\Scripts\\activate && pip install "xinference[all]"')
  })

  it("preserves backslashes in Windows command paths", () => {
    expect(rewriteCommand('.\\tools\\snip.exe dotnet test', matcher))
      .toBe('.\\tools\\snip.exe dotnet test')
  })

  it("rewrites dotnet test to reproduce the contamination path", () => {
    expect(rewriteCommand("dotnet test", matcher)).toBe("snip dotnet test")
  })

  it("does not break redirections around background operator parsing", () => {
    expect(rewriteCommand('go test 2>&1 && dotnet test', matcher))
      .toBe('snip go test 2>&1 && snip dotnet test')
  })
})

describe("tool hooks", () => {
  const matcher = createSnipMatcher([
    {
      name: "dotnet-test",
      command: "dotnet",
      subcommand: "test",
    },
  ])

  let pendingRewrites: Map<string, { originalCommand: string; rewrittenCommand: string; version: 1 }>
  let toolExecuteBefore: ReturnType<typeof createToolExecuteBefore>
  let toolExecuteAfter: ReturnType<typeof createToolExecuteAfter>

  beforeEach(() => {
    pendingRewrites = new Map()
    toolExecuteBefore = createToolExecuteBefore(matcher, pendingRewrites)
    toolExecuteAfter = createToolExecuteAfter(pendingRewrites)
  })

  it("records metadata for rewritten bash commands", async () => {
    const output = { args: { command: "dotnet test" } }
    await toolExecuteBefore({ tool: "bash", sessionID: "s", callID: "c" }, output)

    expect(output.args.command).toBe("snip dotnet test")
    expect(pendingRewrites.get("s:c")).toEqual({
      originalCommand: "dotnet test",
      rewrittenCommand: "snip dotnet test",
      version: 1,
    })

    const afterOutput = { title: "bash", output: "ok", metadata: {} as Record<string, unknown> }
    await toolExecuteAfter(
      {
        tool: "bash",
        sessionID: "s",
        callID: "c",
        args: { command: "snip dotnet test" },
      },
      afterOutput,
    )

    expect(afterOutput.metadata.opencodeSnip).toEqual({
      originalCommand: "dotnet test",
      rewrittenCommand: "snip dotnet test",
      version: 1,
    })
    expect(pendingRewrites.has("s:c")).toBe(false)
  })

  it("ignores non-bash tools", async () => {
    const output = { args: { command: "dotnet test" } }
    await toolExecuteBefore({ tool: "read", sessionID: "s", callID: "c" }, output)
    expect(output.args.command).toBe("dotnet test")
    expect(pendingRewrites.size).toBe(0)
  })

  it("supports shell tool id in addition to bash", async () => {
    const output = { args: { command: "dotnet test" } }
    await toolExecuteBefore({ tool: "shell", sessionID: "s", callID: "c" }, output)
    expect(output.args.command).toBe("snip dotnet test")

    const afterOutput = { title: "shell", output: "ok", metadata: {} as Record<string, unknown> }
    await toolExecuteAfter(
      {
        tool: "shell",
        sessionID: "s",
        callID: "c",
        args: { command: "snip dotnet test" },
      },
      afterOutput,
    )

    expect(afterOutput.metadata.opencodeSnip).toMatchObject({
      originalCommand: "dotnet test",
      rewrittenCommand: "snip dotnet test",
    })
  })

  it("does not persist metadata when command was not rewritten", async () => {
    const output = { args: { command: "dotnet restore" } }
    await toolExecuteBefore({ tool: "bash", sessionID: "s", callID: "c" }, output)

    const afterOutput = { title: "bash", output: "ok", metadata: {} as Record<string, unknown> }
    await toolExecuteAfter(
      {
        tool: "bash",
        sessionID: "s",
        callID: "c",
        args: { command: "dotnet restore" },
      },
      afterOutput,
    )

    expect(afterOutput.metadata).toEqual({})
  })
})

describe("sanitizeMessagesForModel", () => {
  it("restores original command for the model while keeping other data intact", () => {
    const messages = [{
      info: { id: "m1" },
      parts: [{
        id: "p1",
        type: "tool",
        tool: "bash",
        state: {
          status: "completed",
          input: { command: "snip dotnet test", workdir: "Z:/repo" },
          output: "tests passed",
          title: "bash",
          metadata: {
            opencodeSnip: {
              originalCommand: "dotnet test",
              rewrittenCommand: "snip dotnet test",
              version: 1,
            },
          },
        },
      }],
    }]

    sanitizeMessagesForModel(messages)

    expect(messages[0].parts[0]).toMatchObject({
      state: {
        input: {
          command: "dotnet test",
          workdir: "Z:/repo",
        },
        metadata: {
          opencodeSnip: {
            originalCommand: "dotnet test",
            rewrittenCommand: "snip dotnet test",
            version: 1,
          },
        },
      },
    })
  })

  it("does not rewrite explicit user snip commands without plugin metadata", () => {
    const messages = [{
      info: { id: "m1" },
      parts: [{
        id: "p1",
        type: "tool",
        tool: "bash",
        state: {
          status: "completed",
          input: { command: "snip gain" },
          output: "report",
          title: "bash",
          metadata: {},
        },
      }],
    }]

    sanitizeMessagesForModel(messages)
    expect(messages[0].parts[0]).toMatchObject({
      state: { input: { command: "snip gain" } },
    })
  })

  it("accepts plugin metadata stored at the tool part level", () => {
    const messages = [{
      info: { id: "m1" },
      parts: [{
        id: "p1",
        type: "tool",
        tool: "bash",
        metadata: {
          opencodeSnip: {
            originalCommand: "dotnet test",
            rewrittenCommand: "snip dotnet test",
            version: 1,
          },
        },
        state: {
          status: "completed",
          input: { command: "snip dotnet test" },
          output: "tests passed",
          title: "bash",
        },
      }],
    }]

    sanitizeMessagesForModel(messages)
    expect(messages[0].parts[0]).toMatchObject({
      state: { input: { command: "dotnet test" } },
    })
  })
})
