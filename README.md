<div align="center">
  <div align="center">
  <h1>Ariana: Debug what happens when your code runs, using Coding Agents & with zero code change</h1>
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

Ariana is a CLI to automatically add observability to your code and an IDE extension to consume it & provide context-aware debugging capabilities to coding agents. You don't have to change any code in your codebase or specify breakpoints. Currently supports JS/TS & Python.

## ✨ Key Features

Use Ariana VSCode extension to :
- 🕵️ Hover over any expression to see its **last recorded values**
- ⏱️ See **how long** it took for any expression in your code to run.
- 🧵 *Provide runtime history to* **coding agent** *for context-aware debugging* (WIP)

## 💾 How to install

| IDE | Command |
|-----|---------|
| **VSCode** | [Click here to install](vscode:extension/dedale-dev.ariana) or [get it from the marketplace](https://marketplace.visualstudio.com/items?itemName=dedale-dev.ariana) |
| **Cursor / Windsurf (VSCode Forks)** | [Download from open-vsix](https://open-vsx.org/extension/ariana/ariana) then drag the `.vsix` file into your extensions panel in Cursor/Windsurf... |

## 🧵 How to use

Follow the **Getting started** instructions in the Ariana extension panel for the most up-to-date guidance. Below is a summary:

#### 1. Install the `ariana` CLI

The Ariana VS Code extension will guide you through installing the `ariana` CLI if it's not already present on your system. It will detect available package managers (like npm or pip) and provide commands to run directly from the extension.

If you prefer to install it manually, here are the common commands:

| Package Manager | Command                        |
|-----------------|--------------------------------|
| **npm**         | `npm install -g ariana`        |
| **pip**         | `pip install ariana`           |
|                 | `python -m pip install ariana` |
|                 | `python3 -m pip install ariana`|

#### 2. Observe your code with `ariana`

To collect runtime information, run your usual build/execution command, but prefix it with `ariana`. This tells the CLI to instrument a copy of your code (in a local `.ariana` directory) and observe its execution.

```bash
ariana <your usual build & run command>
```

For example:

| Codebase Type   | Command                                      |
|-----------------|----------------------------------------------|
| **JS/TS**       | `ariana npm run dev`                         |
| **Python**      | `ariana python myscript.py --some-options`   |

Run this in each terminal where you execute a part of your application you want to observe.

#### 3. View Traces in VS Code

Open the Ariana panel by clicking on its icon in the Activity Bar.

- If you've run `ariana` on multiple projects, you might be prompted to select the run you want to focus on.
- Traces from your code's execution will appear in the **Traces** tab.

#### 4. Analyze Traces & Hover Over Code

Once traces are loaded, Ariana provides insights directly in your editor:

- 🗺️ **Execution Highlighting**: See which parts of your code ran.
    | Highlight Color | Meaning                                         |
    |-----------------|-------------------------------------------------|
    | 🟢 **Green**    | Code segment ran successfully.                  |
    | 🔴 **Red**      | Code crashed here.                              |
    | ⚫ **Grey/None** | Code segment didn’t run or couldn't be recorded. |

- 🕵️ **Value Hovers**: Hover over any expression in your code to see its last recorded values and execution time.

  ![Demo part 2](https://github.com/dedale-dev/.github/blob/main/demo_part2_0.gif?raw=true)

#### 5. (Optional) Use AI to Understand Traces (WIP)

In the Ariana panel, you can copy the collected traces. You can then paste these into an AI coding assistant with a prompt like:

```
<paste traces>

Using the debugging traces above and your knowledge of the codebase please do <xyz>
```

Tip: Use an agent with a large context window, as traces can be verbose.

*Coming soon: More compact traces and an integrated AI agent for runtime analysis and fixes.*


----------------------------------------
## Preview : 

*To test Ariana before using it on your own code:*

```
git clone https://github.com/dedale-dev/node-hello.git
cd node-hello
npm i
ariana npm run start
```
-----------------------------------------
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

We process and temporarily store for 48 hours your code files on our server based in EU in order to instrument them and help you debug afterwards. It is not sent to any third-party including any LLM provider. An enterprise plan will come later with enterprise-grade security and compliance. If that is important to you, [please let us know](https://discord.gg/Y3TFTmE89g).

## Licence

Code generated and/or transformed by Ariana is yours and not concerned by the following licence and terms.

Ariana is released under AGPLv3. See [LICENCE.txt](LICENCE.txt) for more details.
