# [Ariana](https://ariana.dev)

Ariana is a tool to debug your JS/TS code in development way faster than with a traditional debugger or `console.log` statements.

**Features:**

- 📑 Overlay **recent execution traces** on top of your code
- 🕵️ Inspect **values taken by expressions** in your code 
- ⏱️ See **how long** it took for any expression in your code to run

*Please note this repository is just for issues on the Ariana vscode extension*

## How to use

*Optional: Clone this simple node.js repository if you just want to try out Ariana first:*

```
git clone https://github.com/dedale-dev/node-hello.git
cd node-hello
npm i
```

#### 1) ✨ Run your codebase's `package.json` commands with the Ariana left-side panel, no setup required.

![Demo part 1](https://github.com/dedale-dev/.github/blob/main/demo_part1_v2.gif?raw=true)

#### 2) 👾 Get instant debugging information "traces" from your code files after they got ran by pressing `ctrl + shift + p` and searching for the `Ariana: Toggle Traced Expressions Highlighting` command.
   
- 🗺️ Know which code segments got ran and which didn't
- 🕵️ Inspect the values that were taken by any expression in your code

![Demo part 2](https://github.com/dedale-dev/.github/blob/main/demo_part2_0.gif?raw=true)

#### 3) And voilà! 🥳 No debugger or `console.log` needed anymore in development

![Demo part 3](https://github.com/dedale-dev/.github/blob/main/demo_part2_1.gif?raw=true)

**😵‍💫 Ran into an issue? Need help?** Shoot us [an issue on GitHub](https://github.com/dedale-dev/ariana/issues) or join [our Discord community](https://discord.gg/kX7r6b5dpN) to get help!

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

## Code processing disclaimer

We need to process (but never store!) your JS/TS code files on our server based in EU in order to have Ariana work with it. It is not sent to any third-party including any LLM provider. An enterprise plan will come later with enterprise-grade security and compliance. If that is important to you, [please let us know](https://discord.gg/kX7r6b5dpN).

## Release Notes

### 0.5.2

Added new tutorial gif that noticeably showcases the Ariana side panel button.

Improved the README overall, added example codebase and data disclaimer.

### 0.5.1

Removed python from the description because it is kinda missleading.

### 0.5

Made the extension compatible with VSCode ^1.94.0 (therefore more VSCode forks such as Windsurf)

### 0.1.0 to 0.4.0

Minor documentation tweaks.

### 0.0.1

Initial beta release
