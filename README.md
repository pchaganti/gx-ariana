# Ariana

[Ariana](https://marketplace.visualstudio.com/items?itemName=dedale-dev.ariana&ssr=false#overview) is a tool to debug your JS/TS/Python code in development way faster than with a traditional debugger or `console.log` statements.

**Features:**

- 📑 Overlay **recent execution traces** on top of your code
- 🕵️ Inspect **values taken by expressions** in your code 
- ⏱️ See **how long** it took for any expression in your code to run

*Please note this repository is just for issues on the Ariana vscode extension*

## How to use

1. ✅ Run your JS/TS node.js/browser codebase's `package.json` commands with Ariana, no setup required

![Demo part 1](https://github.com/dedale-dev/.github/blob/main/demo_part1.gif?raw=true)

2. 👾 Get instant debugging information "traces" from your code files after they got ran
   - 🗺️ Know which code segments got ran and which didn't
   - 🕵️ Inspect the values that were taken by any expression in your code

![Demo part 2](https://github.com/dedale-dev/.github/blob/main/demo_part2_0.gif?raw=true)

3. 🥳 No debugger or `console.log` needed anymore in development

![Demo part 3](https://github.com/dedale-dev/.github/blob/main/demo_part2_1.gif?raw=true)

## Requirements

### For JavaScript/TypeScript codebases

- A JS/TS node.js/browser codebase with a `package.json`
- Node.js with the `node` command available

## Supported languages/tech

| Language | Platform/Framework | Status |
|----------|-------------------|---------|
| JavaScript/TypeScript | Node.js | ✅ Supported |
| | Deno | ⚗️ Experimental |
| | Bun | ❌ Not supported (yet) |
| **Browser Frameworks** | | |
| JavaScript/TypeScript | React | ⚗️ Experimental |
| | JQuery/Vanilla JS | ✅ Supported |
| | Vue/Svelte/Angular | ❌ Not supported (yet) |
| **Other Languages** | | |
| Python | All platforms | 🚧 In development |
