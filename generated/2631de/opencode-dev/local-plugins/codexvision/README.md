# CodexVision

CodexVision is an OpenCode plugin that adds an `image_generate` tool powered by the OpenAI Responses API and the hosted `image_generation` tool.

## Features

- generates a single image from a prompt
- saves the result inside `.opencode/generated/`
- returns the saved file path and image metadata to the chat
- works with OpenAI-compatible Responses endpoints that support `image_generation`

## Installation

### 1. Build the plugin

```bash
bun install
bun run build
```

### 2. Register the plugin in OpenCode

Add the plugin path to `~/.config/opencode/opencode.jsonc`:

```jsonc
"plugin": [
  "oh-my-opencode-slim",
  "openqwencode",
  "opencode-antigravity-auth@beta",
  "opencode-tokenspeed-monitor@latest",
  "@tarquinen/opencode-dcp@latest",
  "copilothydra",
  "/Users/rubenbeuker/Documents/codexvision"
]
```

### 3. Provide an API key

You can either export an environment variable:

```bash
export OPENAI_API_KEY=sk-...
```

or configure a direct `apiKey` in the plugin options.

## Usage

Ask the model to call `image_generate`, for example:

```text
Use image_generate to create a square logo for CodexVision with a terminal prompt and vision motif.
```

## Optional plugin configuration

```jsonc
"plugin": [
  [
    "/Users/rubenbeuker/Documents/codexvision",
    {
      "model": "gpt-5.4",
      "baseURL": "https://codex-test.2631.eu/v1",
      "apiKeyEnv": "OPENAI_API_KEY",
      "outputDir": ".opencode/generated"
    }
  ]
]
```

## Output

CodexVision stores generated images in the current worktree, typically at:

```text
.opencode/generated/
```

The tool response includes:

- the absolute file path
- the relative file path
- model, size, and quality
- the revised prompt when the API returns one
