const esbuild = require('esbuild');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const path = require('path');

const execAsync = promisify(exec);
const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function copyWebviewDist() {
    console.log('[webview] copying dist files 2...');
    try {
        await fs.ensureDir('dist/webview-ui');
        await fs.removeSync('dist/webview-ui/dist');
        await fs.ensureDir('webview-ui/dist');
        await fs.copy('webview-ui/dist', 'dist/webview-ui/dist');
        console.log('[webview] dist files copied');
    } catch (error) {
        console.error('[webview] failed to copy dist files:', error);
        throw error;
    }
}

async function buildWebviewUI() {
    console.log('[webview] building...');
    try {
        if (watch) {
            // Start webview build in background without waiting
            execAsync('cd webview-ui && npm run dev');
            await new Promise(resolve => setTimeout(resolve, 5000));
            await copyWebviewDist();
        } else {
            await execAsync('cd webview-ui && npm run build');
            console.log('[webview] build finished');
            await copyWebviewDist();
        }
    } catch (error) {
        console.error('[webview] build failed:', error);
        throw error;
    }
}

async function main() {
    // First build the webview UI
    await buildWebviewUI();

    const ctx = await esbuild.context({
        entryPoints: ['src/extension.ts'],
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'node',
        outdir: 'dist',
        external: ['vscode'],
        logLevel: 'warning',
        plugins: [
            esbuildProblemMatcherPlugin
        ]
    });

    if (watch) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }
}

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',

    setup(build) {
        build.onStart(() => {
            console.log('[watch] build started');
        });
        build.onEnd(result => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                if (location === null) { return; }
                console.error(`    ${location.file}:${location.line}:${location.column}:`);
            });
            console.log('[watch] build finished');
        });
    }
};

main().catch(e => {
    console.error(e);
    process.exit(1);
});