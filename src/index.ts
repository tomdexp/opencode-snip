import type { Plugin } from "@opencode-ai/plugin"

export const SnipPlugin: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return
      const command = output.args.command;
      if (!command || typeof command !== "string") return
      if (command.startsWith("snip ")) return

      // Extract first command (before && or | or ;)
      const firstCmd = command.split(/[;&|]/)[0].trim()
      
      // Strip env var prefixes to get bare command (e.g. "go test")
      // Remove all env var prefixes: VAR=value or VAR=value CMD
      let bareCmd = firstCmd.replace(/^[A-Za-z_][A-Za-z0-9_]*=[^\s]*\s*/, "")
      // Keep stripping until no more env vars at start
      while (/^[A-Za-z_][A-Za-z0-9_]*=[^\s]*\s+/.test(bareCmd)) {
        bareCmd = bareCmd.replace(/^[A-Za-z_][A-Za-z0-9_]*=[^\s]*\s*/, "")
      }

      // Replace bareCmd with "snip bareCmd" in original command
      output.args.command = command.replace(bareCmd, `snip ${bareCmd}`)
    }
  }
}

export default SnipPlugin
