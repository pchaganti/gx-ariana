# [Ariana](https://ariana.dev)

Ariana is an IDE extension and CLI tool to debug your JS/TS code in development way faster than with a traditional debugger or `console.log` statements.

**Features:**

- 📑 Overlay **recent execution traces** on top of your code
- 🕵️ Inspect **values taken by expressions** in your code 
- ⏱️ See **how long** it took for any expression in your code to run

## How to use

#### 1) 💾 Install the `ariana` CLI

With npm:

```bash
npm install -g ariana
```

With pip:

```bash
pip install ariana
```

#### 2) ✨ Run supported code as you would from the command line but with the `ariana` command along side it

```bash
ariana <run command>
```

For example, on a Node.js codebase it could be:

```bash
ariana npm run dev
```

#### 3) 👾 In your IDE, get instant debugging information in your code files.

You can install the extension on the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=dedale-dev.ariana), or by searching for `Ariana` in the extensions tab in VSCode or Cursor.

- Open a code file, press `ctrl + shift + p` and search for the `Ariana: Toggle Traced Expressions Highlighting` command.
- 🗺️ Know which code segments got ran and which didn't
- 🕵️ Inspect the values that were taken by any expression in your code

![Demo part 2](https://github.com/dedale-dev/.github/blob/main/demo_part2_0.gif?raw=true)

*Optional: If you just want to try out Ariana on example piece of code before using it on your own code, you can do this:*

```
git clone https://github.com/dedale-dev/node-hello.git
cd node-hello
npm i
ariana npm run start
```

## Troubleshooting / Help

😵‍💫 Ran into an issue? Need help? Shoot us [an issue on GitHub](https://github.com/dedale-dev/ariana/issues) or join [our Discord community](https://discord.gg/Y3TFTmE89g) to get help!

## Requirements

### For JavaScript/TypeScript codebases

- A JS/TS node.js/browser codebase with a `package.json`
- The `ariana` command installed with `npm install -g ariana` (or any other installation method)

## Supported languages/tech

| Language | Platform/Framework | Status |
|----------|-------------------|---------|
| JavaScript/TypeScript | Node.js | ✅ Supported |
| | Bun | ✅ Supported |
| | Deno | ⚗️ Experimental |
| **Browser Frameworks** | | |
| JavaScript/TypeScript | React | ⚗️ Experimental |
| | JQuery/Vanilla JS | ✅ Supported |
| | Vue/Svelte/Angular | ❌ Not supported (yet) |
| **Other Languages** | | |
| Python | All platforms | 🚧 In development |

## Code processing disclaimer

We need to process (but never store!) your JS/TS code files on our server based in EU in order to have Ariana work with it. It is not sent to any third-party including any LLM provider. An enterprise plan will come later with enterprise-grade security and compliance. If that is important to you, [please let us know](https://discord.gg/Y3TFTmE89g).
