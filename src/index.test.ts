import { describe, it, expect, beforeEach } from "vitest"
import { SnipPlugin } from "./index"

describe("SnipPlugin", () => {
  let mockInput: any
  let mockOutput: any

  beforeEach(() => {
    mockInput = { tool: "bash", args: {} }
    mockOutput = { args: { command: "" } }
  })

  it("should prefix simple command with snip", async () => {
    const plugin = await SnipPlugin()
    mockOutput.args.command = "go test ./..."
    await plugin["tool.execute.before"](mockInput, mockOutput)
    expect(mockOutput.args.command).toBe("snip go test ./...")
  })

  it("should handle command with one env var prefix", async () => {
    const plugin = await SnipPlugin()
    mockOutput.args.command = "CGO_ENABLED=0 go test ./..."
    await plugin["tool.execute.before"](mockInput, mockOutput)
    expect(mockOutput.args.command).toBe("CGO_ENABLED=0 snip go test ./...")
  })

  it("should handle command with multiple env var prefixes", async () => {
    const plugin = await SnipPlugin()
    mockOutput.args.command = "CGO_ENABLED=0 GOOS=linux go test ./..."
    await plugin["tool.execute.before"](mockInput, mockOutput)
    expect(mockOutput.args.command).toBe("CGO_ENABLED=0 GOOS=linux snip go test ./...")
  })

  it("should handle command with &&", async () => {
    const plugin = await SnipPlugin()
    mockOutput.args.command = "go test && go build"
    await plugin["tool.execute.before"](mockInput, mockOutput)
    expect(mockOutput.args.command).toBe("snip go test && go build")
  })

  it("should handle command with |", async () => {
    const plugin = await SnipPlugin()
    mockOutput.args.command = "git log | head"
    await plugin["tool.execute.before"](mockInput, mockOutput)
    expect(mockOutput.args.command).toBe("snip git log | head")
  })

  it("should handle command with ;", async () => {
    const plugin = await SnipPlugin()
    mockOutput.args.command = "go test; go build"
    await plugin["tool.execute.before"](mockInput, mockOutput)
    expect(mockOutput.args.command).toBe("snip go test; go build")
  })

  it("should not double prefix already prefixed command", async () => {
    const plugin = await SnipPlugin()
    mockOutput.args.command = "snip go test"
    await plugin["tool.execute.before"](mockInput, mockOutput)
    expect(mockOutput.args.command).toBe("snip go test")
  })

  it("should not modify non-bash tool calls", async () => {
    const plugin = await SnipPlugin()
    mockInput.tool = "read"
    mockOutput.args.command = "go test"
    await plugin["tool.execute.before"](mockInput, mockOutput)
    expect(mockOutput.args.command).toBe("go test")
  })
})
