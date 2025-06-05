# Ariana VSCode Extension Development Guide

## Build/Test Commands
- **Build**: `npm run compile` (type check + build)
- **Type check only**: `npm run check-types`
- **Watch mode**: `npm run watch` (watches both TypeScript and esbuild)
- **Package for release**: `npm run package`
- **Webview build**: `cd webview-ui && npm run build`
- **Webview dev**: `cd webview-ui && npm run dev` (watch mode)

## Code Style & Conventions
- **Imports**: Use named imports (`import { x } from 'y'`), namespace imports for vscode (`import * as vscode`), relative paths for local modules
- **Naming**: PascalCase for classes/interfaces, camelCase for methods/variables, underscore prefix for private fields (`_view`)
- **Error handling**: Try-catch blocks with `console.error(error)`, async `.catch()` for promises
- **Types**: Enable strict mode, use explicit typing, prefer interfaces over types
- **ESLint rules**: Semi-colons required, curly braces enforced, strict equality (`===`), camelCase/PascalCase imports

## Project Structure
- `/src`: Main extension code (TypeScript)
- `/webview-ui`: React frontend with Vite build system
- `/dist`: Built extension output
- Main entry: `src/extension.ts`
- Classes use private fields with underscore prefix
