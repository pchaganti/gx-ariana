# Dedale Ariana Landing Page Development Guide

## Build/Test Commands
- **Dev server**: `npm run dev` (Vite dev server with hot reload)
- **Build**: `npm run build` (production build with SvelteKit + Vite)
- **Preview**: `npm run preview` (preview production build locally)
- **Type check**: `npm run check` (svelte-check + TypeScript)
- **Type check watch**: `npm run check:watch` (continuous type checking)
- **Format**: `npm run format` (Prettier)
- **Lint**: `npm run lint` (Prettier + ESLint)

## Code Style & Conventions
- **Formatting**: Use tabs, single quotes, no trailing commas, 100 char width
- **Tools**: Prettier + ESLint with Svelte and TypeScript plugins
- **Components**: Svelte 5 syntax with TypeScript
- **Styling**: TailwindCSS with plugins (forms, typography, scrollbar)
- **Adapter**: Node.js adapter for deployment
- **Imports**: ES modules, relative paths for local components

## Project Structure
- `/src/routes`: SvelteKit pages and API routes
- `/src/components`: Reusable Svelte components
- `/src/lib`: Shared utilities and modules
- Uses SvelteKit with Node.js adapter and TailwindCSS
- TypeScript configuration with strict type checking
