export type BuiltinFilterSpec = {
  readonly name: string
  readonly command: string
  readonly subcommand?: string
  readonly excludeFlags?: readonly string[]
  readonly requireFlags?: readonly string[]
}

// Generated from edouard-claude/snip built-in filters.
export const BUILTIN_FILTERS: readonly BuiltinFilterSpec[] = [
  {
    name: "ansible-playbook",
    command: "ansible-playbook",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "aws",
    command: "aws",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "basedpyright",
    command: "basedpyright",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "biome",
    command: "biome",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "brew-install",
    command: "brew",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "bundle-install",
    command: "bundle",
    subcommand: "install",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "cargo-build",
    command: "cargo",
    subcommand: "build",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "cargo-check",
    command: "cargo",
    subcommand: "check",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "cargo-clippy",
    command: "cargo",
    subcommand: "clippy",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "cargo-install",
    command: "cargo",
    subcommand: "install",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "cargo-nextest",
    command: "cargo",
    subcommand: "nextest",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "cargo-test",
    command: "cargo",
    subcommand: "test",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "composer-install",
    command: "composer",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "curl",
    command: "curl",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "df",
    command: "df",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "diff",
    command: "diff",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "docker-build",
    command: "docker",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "docker-compose",
    command: "docker-compose",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "docker-images",
    command: "docker",
    subcommand: "images",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "docker-logs",
    command: "docker",
    subcommand: "logs",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "docker-ps",
    command: "docker",
    subcommand: "ps",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "dotnet-build",
    command: "dotnet",
    subcommand: "build",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "dotnet-format",
    command: "dotnet",
    subcommand: "format",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "dotnet-test",
    command: "dotnet",
    subcommand: "test",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "du",
    command: "du",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "eslint",
    command: "eslint",
    excludeFlags: [
      "-f",
      "--format"
    ],
    requireFlags: []
  },
  {
    name: "fail2ban",
    command: "fail2ban-client",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "find",
    command: "find",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "g++",
    command: "g++",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "gcc",
    command: "gcc",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "gcloud",
    command: "gcloud",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "gh-issue",
    command: "gh",
    subcommand: "issue",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "gh-pr",
    command: "gh",
    subcommand: "pr",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "gh-run",
    command: "gh",
    subcommand: "run",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "git-add",
    command: "git",
    subcommand: "add",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "git-branch",
    command: "git",
    subcommand: "branch",
    excludeFlags: [
      "-d",
      "-D",
      "-m",
      "-M",
      "--delete",
      "--move",
      "--copy"
    ],
    requireFlags: []
  },
  {
    name: "git-commit",
    command: "git",
    subcommand: "commit",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "git-diff",
    command: "git",
    subcommand: "diff",
    excludeFlags: [
      "--stat",
      "--name-only",
      "--name-status"
    ],
    requireFlags: []
  },
  {
    name: "git-fetch",
    command: "git",
    subcommand: "fetch",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "git-log",
    command: "git",
    subcommand: "log",
    excludeFlags: [
      "--format",
      "--pretty",
      "--graph",
      "--oneline"
    ],
    requireFlags: []
  },
  {
    name: "git-pull",
    command: "git",
    subcommand: "pull",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "git-push",
    command: "git",
    subcommand: "push",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "git-show",
    command: "git",
    subcommand: "show",
    excludeFlags: [
      "--stat",
      "--format",
      "--pretty",
      "--name-only",
      "--name-status"
    ],
    requireFlags: []
  },
  {
    name: "git-stash",
    command: "git",
    subcommand: "stash",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "git-status",
    command: "git",
    subcommand: "status",
    excludeFlags: [
      "--porcelain",
      "--short",
      "-s"
    ],
    requireFlags: []
  },
  {
    name: "git-worktree",
    command: "git",
    subcommand: "worktree",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "go-build",
    command: "go",
    subcommand: "build",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "go-test",
    command: "go",
    subcommand: "test",
    excludeFlags: [
      "-json",
      "-v",
      "-bench",
      "-run"
    ],
    requireFlags: []
  },
  {
    name: "go-vet",
    command: "go",
    subcommand: "vet",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "golangci-lint",
    command: "golangci-lint",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "gradle",
    command: "gradle",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "grep",
    command: "grep",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "gt",
    command: "gt",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "hadolint",
    command: "hadolint",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "helm",
    command: "helm",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "iptables",
    command: "iptables",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "jest",
    command: "jest",
    excludeFlags: [
      "--json",
      "--verbose"
    ],
    requireFlags: []
  },
  {
    name: "jira",
    command: "jira",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "jj",
    command: "jj",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "jq",
    command: "jq",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "just",
    command: "just",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "kubectl-get",
    command: "kubectl",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "kubectl-logs",
    command: "kubectl",
    subcommand: "logs",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "liquibase",
    command: "liquibase",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "ls",
    command: "ls",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "make",
    command: "make",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "markdownlint",
    command: "markdownlint",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "mise",
    command: "mise",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "mix-compile",
    command: "mix",
    subcommand: "compile",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "mix-format",
    command: "mix",
    subcommand: "format",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "mvn",
    command: "mvn",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "mypy",
    command: "mypy",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "next-build",
    command: "next",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "npm-install",
    command: "npm",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "npx",
    command: "npx",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "nx",
    command: "nx",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "ollama",
    command: "ollama",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "oxlint",
    command: "oxlint",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "ping",
    command: "ping",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "pio",
    command: "pio",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "pip-install",
    command: "pip",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "playwright",
    command: "playwright",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "pnpm-install",
    command: "pnpm",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "pnpm-list",
    command: "pnpm",
    subcommand: "list",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "poetry-install",
    command: "poetry",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "pre-commit",
    command: "pre-commit",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "prettier",
    command: "prettier",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "prisma",
    command: "prisma",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "ps",
    command: "ps",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "psql",
    command: "psql",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "pytest",
    command: "pytest",
    excludeFlags: [
      "--tb=no",
      "--co",
      "--collect-only"
    ],
    requireFlags: []
  },
  {
    name: "quarto",
    command: "quarto",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "rails-migrate",
    command: "rails",
    subcommand: "db:migrate",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "rails-routes",
    command: "rails",
    subcommand: "routes",
    excludeFlags: [
      "-g",
      "--grep",
      "-c",
      "--controller"
    ],
    requireFlags: []
  },
  {
    name: "rake",
    command: "rake",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "rg",
    command: "rg",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "rspec",
    command: "rspec",
    excludeFlags: [
      "--format",
      "-f"
    ],
    requireFlags: []
  },
  {
    name: "rsync",
    command: "rsync",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "rubocop",
    command: "rubocop",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "ruff",
    command: "ruff",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "rustc",
    command: "rustc",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "shellcheck",
    command: "shellcheck",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "shopify",
    command: "shopify",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "skopeo",
    command: "skopeo",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "sops",
    command: "sops",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "spring-boot",
    command: "spring-boot",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "ssh",
    command: "ssh",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "stat",
    command: "stat",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "swift-build",
    command: "swift",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "systemctl",
    command: "systemctl",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "task",
    command: "task",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "terraform",
    command: "terraform",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "tofu",
    command: "tofu",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "tree",
    command: "tree",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "trunk-build",
    command: "trunk",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "tsc",
    command: "tsc",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "turbo",
    command: "turbo",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "ty",
    command: "ty",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "uv-sync",
    command: "uv",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "vitest",
    command: "vitest",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "wc",
    command: "wc",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "wget",
    command: "wget",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "xcodebuild",
    command: "xcodebuild",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "yadm",
    command: "yadm",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "yamllint",
    command: "yamllint",
    excludeFlags: [],
    requireFlags: []
  },
  {
    name: "yarn-install",
    command: "yarn",
    excludeFlags: [],
    requireFlags: []
  }
] as const
