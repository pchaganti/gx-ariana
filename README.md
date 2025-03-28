<div align="center">
  <div align="center">
  <h1>Ariana: Debug your code effortlessly with AI</h1>
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

Ariana is an IDE extension to understand what happens during runtime. You don't have to put `print()`, `console.log()` or breakpoints. Currently supports JS/TS & Python.

## ✨ Key Features

Use Ariana VSCode extension to :
- 🕵️ Hover over any expression to see its **last recorded values**
- ⏱️ See **how long** it took for any expression in your code to run.
- 🧵 *Provide runtime history to* **coding agent** *for context-aware debugging* (WIP)



## 💾 How to install

#### 1) Install the `extension` on your IDE 

Install the extension on the [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=dedale-dev.ariana), or by searching for `Ariana` in the extensions tab in VSCode or Cursor.

#### 2) Install the `ariana` CLI

| Package Manager | Command                        |
|-----------------|--------------------------------|
| **npm**         | `npm install -g ariana`        |
| **pip**         | `pip install ariana`           |



## 📖 How to use

#### 1) ✨ - REQUIRED - Add `ariana` just in front of your command. It will collect runtime information

```bash
ariana <run command>
```

For example:

| Codebase Type   | Command                                      |
|-----------------|----------------------------------------------|
| **JS/TS**       | `ariana npm run dev`                         |
| **Python**      | `ariana python myscript.py --some-options-maybe` |


#### 2) 👾 View runtime insights directly in your code.

Open a code file, press **`ctrl + shift + p`** and search for the `Ariana: Toggle Traced Expressions Highlighting` command.

- 🗺️ Identify which sections of your code ran  


    | Highlight Color | Meaning                        |
    |----------------|--------------------------------|
    | 🟢 **Green**   | Code segment ran successfully. |
    | 🔴 **Red**     | Code crashed here. |
    | ⚪ **None**     | Code segment didn’t run. | 


- 🕵️ Hover over any expression to reveal its past values

  ![Demo part 2](https://github.com/dedale-dev/.github/blob/main/demo_part2_0.gif?raw=true)


#### 3) 🤖 Use AI to recap what your code did & identify error root causes (WIP)

Run:

```
ariana --recap
```
It will tell you what might have gone wrong with your code.

*Coming soon: A coding agent that answers questions and directly impacts your codebase*


----------------------------------------
## Preview : 

To test Ariana before using it on your own code:*

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

We process (but never store!) your JS/TS code files on our server based in EU. It is not sent to any third-party including any LLM provider. An enterprise plan will come later with enterprise-grade security and compliance. If that is important to you, [please let us know](https://discord.gg/Y3TFTmE89g).

## Licence

Ariana is released under AGPLv3. See [LICENCE.txt](LICENCE.txt) for more details.

tl;dr: If you use Ariana as intended, which means in development, this is nothing to worry about as you don't technically bundle Ariana with your released code. If you use it in your production code, whether deployed on a server or on the end-user's machine in a code or binary format, your code needs to be available to the public under the same licence. We can lift that requirement upon request, even for free if your project is small. Please [let us know](mailto:an.nougaret@gmail.com).
