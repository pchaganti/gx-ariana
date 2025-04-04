import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as childProcess from 'child_process';
import { ProjectContext } from './bindings/ProjectContext';

/**
 * Get the operating system information
 */
export function getOSInfo(): { os: string; isWindows: boolean } {
  const platform = os.platform();
  const isWindows = platform === 'win32';
  return {
    os: platform,
    isWindows
  };
}

/**
 * Generate a file tree representation of the workspace
 * @param workspacePath Path to the workspace
 * @param maxDepth Maximum depth to traverse
 * @param maxFiles Maximum number of files to include
 */
export function generateFilesTree(workspacePath: string, maxDepth: number = 3, maxFiles: number = 100): string {
  let fileCount = 0;
  // Ignore directories with . at the start of their name
  const ignoreDirs = ['node_modules', '__pycache__', 'venv', '.venv', 'env', '.env', 'dist', 'build'];
  
  // Priority file extensions
  const highPriorityExtensions = ['js', 'ts', 'tsx', 'jsx', 'py', 'json', 'toml', 'md'];
  
  function traverseDir(currentPath: string, depth: number = 0): string {
    // Limit to depth 0 to 3
    if (depth > maxDepth || fileCount >= maxFiles) {
      return '';
    }

    try {
      const items = fs.readdirSync(currentPath);
      let result = '';
      
      // Calculate max items for this directory based on depth
      const maxItemsForDepth = Math.max(10, 100 - (10 * depth));
      
      // Sort items to prioritize high priority extensions
      const sortedItems = items.sort((a, b) => {
        const extA = path.extname(a).toLowerCase().substring(1);
        const extB = path.extname(b).toLowerCase().substring(1);
        
        const isPriorityA = highPriorityExtensions.includes(extA);
        const isPriorityB = highPriorityExtensions.includes(extB);
        
        if (isPriorityA && !isPriorityB) { return -1; }
        if (!isPriorityA && isPriorityB) { return 1; }
        return a.localeCompare(b);
      });
      
      let dirCount = 0;
      
      // First pass: process directories
      for (const item of sortedItems) {
        if (fileCount >= maxFiles || dirCount >= maxItemsForDepth) {
          break;
        }
        
        const itemPath = path.join(currentPath, item);
        
        try {
          const stats = fs.statSync(itemPath);
          
          if (stats.isDirectory()) {
            // Skip directories that start with a dot
            if (item.startsWith('.') || ignoreDirs.includes(item)) {
              continue;
            }
            
            dirCount++;
            result += '  '.repeat(depth) + `${item}/\n`;
            result += traverseDir(itemPath, depth + 1);
          }
        } catch (error) {
          // Skip files we can't access
          continue;
        }
      }
      
      let fileItemCount = 0;
      
      // Second pass: process files
      for (const item of sortedItems) {
        if (fileCount >= maxFiles || (dirCount + fileItemCount) >= maxItemsForDepth) {
          result += '  '.repeat(depth) + `... (more files)\n`;
          break;
        }
        
        const itemPath = path.join(currentPath, item);
        
        try {
          const stats = fs.statSync(itemPath);
          
          if (!stats.isDirectory()) {
            fileCount++;
            fileItemCount++;
            result += '  '.repeat(depth) + `${item}\n`;
          }
        } catch (error) {
          // Skip files we can't access
          continue;
        }
      }
      
      return result;
    } catch (error) {
      return `Error reading directory: ${error}\n`;
    }
  }
  
  return traverseDir(workspacePath);
}

/**
 * Identify important files in the workspace
 * @param workspacePath Path to the workspace
 */
export function identifyImportantFiles(workspacePath: string): string[] {
  const importantFilePatterns = [
    // Package managers
    'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    'requirements.txt', 'Pipfile', 'Pipfile.lock', 'pyproject.toml', 'poetry.lock',
    'Cargo.toml', 'Cargo.lock',
    // Configuration files
    '.gitignore', '.arianaignore', '.eslintrc', '.prettierrc', 'tsconfig.json',
    'jest.config.js', 'vite.config.ts', 'vite.config.js', 'webpack.config.js',
    // Entry points
    'main.py', 'app.py', 'index.js', 'index.ts', 'main.js', 'main.ts',
    'src/index.js', 'src/index.ts', 'src/main.js', 'src/main.ts',
    // Documentation
    'README.md', 'README.txt', 'CONTRIBUTING.md', 'LICENSE'
  ];
  
  const importantFiles: string[] = [];
  
  function findImportantFiles(dir: string) {
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const relativePath = path.relative(workspacePath, itemPath);
        
        try {
          const stats = fs.statSync(itemPath);
          
          if (stats.isDirectory()) {
            // Skip node_modules and other common directories to avoid excessive scanning
            if (['node_modules', '.git', '__pycache__', 'venv', '.venv', 'env', '.env', 'dist', 'build'].includes(item)) {
              continue;
            }
            
            findImportantFiles(itemPath);
          } else {
            // Check if this file matches any of our important patterns
            if (importantFilePatterns.includes(item) || importantFilePatterns.includes(relativePath)) {
              importantFiles.push(relativePath);
            }
          }
        } catch (error) {
          // Skip files we can't access
          continue;
        }
      }
    } catch (error) {
      console.error(`Error reading directory: ${error}`);
    }
  }
  
  findImportantFiles(workspacePath);
  return importantFiles;
}

/**
 * Get the content of a file
 * @param filePath Path to the file
 * @returns File content as a string, or null if the file doesn't exist or can't be read
 */
function getFileContent(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Generate the complete project context
 * @param workspacePath Path to the workspace
 * @param currentFilePath Optional path to the currently focused file
 */
export async function generateProjectContext(workspacePath: string, currentFilePath?: string): Promise<ProjectContext> {
  const osInfo = getOSInfo();
  const filesTree = generateFilesTree(workspacePath);
  const importantWorkspaceFiles = identifyImportantFiles(workspacePath);
  const importantWorkspaceFileContent: { [key: string]: string | null } = {};
  const availableCommands = await getAvailableCommands();
  
  const importantFilePatterns = [
    'package.json',
    'tsconfig.json',
    'pyproject.toml',
    'requirements.txt',
    'Cargo.toml',
    'Makefile',
    'CMakeLists.txt',
    'go.mod',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts'
  ];

  for (const pattern of importantFilePatterns) {
    const filePath = path.join(workspacePath, pattern);
    if (fs.existsSync(filePath)) {
      importantWorkspaceFileContent[pattern] = getFileContent(filePath);
    }
  }
  
  // Return the project context in the format expected by the API
  const context: ProjectContext = {
    workspace_path: workspacePath,
    os: osInfo.os,
    files_tree: filesTree,
    important_workspace_files: importantWorkspaceFiles,
    important_workspace_file_content: importantWorkspaceFileContent,
    available_commands: availableCommands || null,
    current_focused_file_path: currentFilePath || null,
    current_focused_file_content: currentFilePath ? getFileContent(currentFilePath) : null
  };
  
  return context;
}

/**
 * Check if a command is available on the system
 * @param command Command to check
 * @returns True if the command is available, false otherwise
 */
async function isCommandAvailable(command: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const platform = os.platform();
    const cmd = platform === 'win32' ? 'where' : 'which';
    const process = childProcess.spawn(cmd, [command], {
      shell: true,
      stdio: 'ignore'
    });

    process.on('close', (code) => {
      resolve(code === 0);
    });

    // Set a timeout in case the command hangs
    setTimeout(() => {
      process.kill();
      resolve(false);
    }, 1000);
  });
}

/**
 * Get available development commands on the system
 * @returns Object with command availability information
 */
async function getAvailableCommands(): Promise<Record<string, boolean>> {
  const commonCommands = [
    // JavaScript/TypeScript
    'node', 'deno', 'npm', 'npx', 'yarn', 'pnpm', 'ts-node', 'tsc', 'bun',
    // Python
    'python', 'python3', 'pip', 'pip3', 'poetry', 'uv', 'pytest', 'flask', 'django-admin',
    // Other build tools
    'make', 'cmake', 'bazel', 'ninja'
  ];

  const availableCommands: Record<string, boolean> = {};
  const checkPromises = commonCommands.map(async (command) => {
    try {
      // Try with --version first, then --help if that fails
      const versionCheck = await new Promise<boolean>((resolve) => {
        const process = childProcess.spawn(command, ['--version'], {
          shell: true,
          stdio: 'ignore'
        });
        
        process.on('close', (code) => {
          resolve(code === 0);
        });
        
        setTimeout(() => {
          process.kill();
          resolve(false);
        }, 1000);
      });
      
      if (versionCheck) {
        availableCommands[command] = true;
        return;
      }
      
      // Try with --help if --version failed
      availableCommands[command] = await new Promise<boolean>((resolve) => {
        const process = childProcess.spawn(command, ['--help'], {
          shell: true,
          stdio: 'ignore'
        });
        
        process.on('close', (code) => {
          resolve(code === 0);
        });
        
        setTimeout(() => {
          process.kill();
          resolve(false);
        }, 1000);
      });
    } catch (error) {
      availableCommands[command] = false;
    }
  });

  await Promise.all(checkPromises);
  return availableCommands;
}

// If this script is run directly (not imported)
if (require.main === module) {
  const args = process.argv.slice(2);
  const workspacePath = args[0];
  const currentFilePath = args[1];
  
  if (!workspacePath) {
    console.error('Please provide a workspace path');
    process.exit(1);
  }
  
  generateProjectContext(workspacePath, currentFilePath).then((context) => {
    console.log(JSON.stringify(context, null, 2));
  });
}
