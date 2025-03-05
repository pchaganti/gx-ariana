<div align="center">
  <div align="center">
  <h1>Ariana: Spy on your code</h1>
  <div align="center">
    <img src="https://github.com/dedale-dev/.github/blob/main/ariana_readme_thumbnail.png?raw=true" alt="Ariana Screenshot" width="800">
  </div>
  <a href="https://discord.gg/Y3TFTmE89g"><img src="https://img.shields.io/discord/1312017605955162133?style=for-the-badge&color=7289da&label=Discord&logo=discord&logoColor=ffffff" alt="Join our Discord"></a>
  <a href="https://twitter.com/anic_dev"><img src="https://img.shields.io/badge/Follow-@anic_dev-black?style=for-the-badge&logo=x&logoColor=white" alt="Follow us on X"></a>
  <br/>
  <a href="https://marketplace.visualstudio.com/items?itemName=dedale-dev.ariana"><img src="https://img.shields.io/visual-studio-marketplace/v/dedale-dev.ariana?style=for-the-badge&label=VS%20Code&logo=visualstudiocode&logoColor=white&color=0066b8" alt="VS Code Extension"></a>
  <a href="https://ariana.dev"><img src="https://img.shields.io/badge/Website-ariana.dev-blue?style=for-the-badge&color=FF6B6B" alt="Website"></a>
  <a href="https://github.com/dedale-dev/ariana/issues"><img src="https://img.shields.io/github/issues/dedale-dev/ariana?style=for-the-badge&logo=github&color=4CAF50" alt="GitHub Issues"></a>
  <a href="https://www.npmjs.com/package/ariana"><img alt="NPM Downloads" src="https://img.shields.io/npm/dt/ariana?style=for-the-badge&logo=npm&color=CB3837"></a>
  <a href="https://pypi.org/project/ariana"><img alt="PyPI Downloads" src="https://img.shields.io/pypi/dm/ariana?style=for-the-badge&logo=pypi&color=0086b8"></a>
  <hr>
  </div>
</div>

Ariana is an IDE extension and CLI tool to understand what your JS, TS and Python code does when it runs in development way faster than with a traditional debugger or with `print()` or `console.log()`.

## ✨ Key Features

Just by running your code with the `ariana` CLI and by using the Ariana VSCode extension, you can:
- 🕵️ Inspect the **last values taken by any expression** in your code just by hovering it.
- ⏱️ See **how long** it took for any expression in your code to run.
- 🧵 *Feed traces* ***to Copilot/Cursor*** *via MCP so they can know everything that happened when your code ran.* (soon) 

## 📖 How to use

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

For example, on a JS/TS codebase it could be:

```bash
ariana npm run dev
```

... and on a Python codebase it could be:

```bash
ariana python myscript.py --some-options-maybe
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

### For JavaScript/TypeScript

- A JS/TS node.js/browser codebase with a `package.json`
- The `ariana` command installed with `npm install -g ariana` (or any other installation method)

### For Python

- Some Python `>= 3.9` code files (Notebooks not supported yet)
- The `ariana` command installed with `pip install ariana` **outside of a virtual environment** (or any other installation method)

## Supported languages/tech
| Language | Platform/Framework | Status |
|----------|-------------------|---------|
| JavaScript/TypeScript | Node.js | ✅ Supported |
| | Bun | ✅ Supported |
| | Deno | ⚗️ Might work |
| **Browser Frameworks** | | |
| JavaScript/TypeScript | React & `.jsx` / `.tsx` | ✅ Supported |
| | JQuery/Vanilla JS | ✅ Supported |
| | Vue/Svelte/Angular | ❌ Only `.js` / `.ts` |
| **Other Languages** | | |
| Python | Scripts / Codebases | ✅ Supported |
| | Jupyter Notebooks | ❌ Not supported (yet) |

## Code processing disclaimer

We need to process (but never store!) your JS/TS code files on our server based in EU in order to have Ariana work with it. It is not sent to any third-party including any LLM provider. An enterprise plan will come later with enterprise-grade security and compliance. If that is important to you, [please let us know](https://discord.gg/Y3TFTmE89g).
