import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as childProcess from 'child_process';
import { ProjectContext } from './bindings/ProjectContext';
import { SystemCommand } from './bindings/SystemCommand';

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
    system_commands: availableCommands!,
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
    let cmd: string;
    let args: string[];
    
    if (platform === 'win32') {
      // On Windows, try both 'where' and direct command check with 'cmd /c'
      cmd = 'cmd';
      args = ['/c', `(where ${command} || ${command} --version || ${command} -v) 2>nul`];
    } else {
      // On Unix-like systems, use 'which'
      cmd = 'which';
      args = [command];
    }

    console.log(`Checking availability of command: ${command}`);
    console.log(`Command: ${cmd}, Args: ${args}`);
    
    const process = childProcess.spawn(cmd, args, {
      shell: true,
      stdio: 'ignore'
    });

    process.on('close', (code) => {
      console.log(`Command closed with code: ${code}`);
      resolve(code === 0);
    });

    // Set a timeout in case the command hangs
    setTimeout(() => {
      console.log(`Command timeout: ${command}`);
      process.kill();
      resolve(false);
    }, 1000);
  });
}

/**
 * Get available development commands on the system
 * @returns Object with command availability information and usage examples
 */
async function getAvailableCommands(): Promise<SystemCommand[]> {
  const commandsInfo: Record<string, { description: string; goodExamples: string[]; badExamples: string[] }> = {
    // JavaScript/TypeScript
    'node': {
      description: 'JavaScript runtime',
      goodExamples: ['node script.js', 'node index.js'],
      badExamples: ['node script.ts', 'node script.py']
    },
    'deno': {
      description: 'Secure JavaScript/TypeScript runtime',
      goodExamples: ['deno run script.ts', 'deno run main.js'],
      badExamples: ['deno script.js', 'deno run script.py']
    },
    'npm': {
      description: 'Node package manager',
      goodExamples: ['npm start', 'npm run build', 'npm test'],
      badExamples: ['npm script.js', 'npm execute start']
    },
    'npx': {
      description: 'Node package runner',
      goodExamples: ['npx create-react-app my-app', 'npx tsc'],
      badExamples: ['npx start', 'npx script.js']
    },
    'yarn': {
      description: 'Alternative package manager',
      goodExamples: ['yarn start', 'yarn build', 'yarn test'],
      badExamples: ['yarn script.js', 'yarn execute start']
    },
    'pnpm': {
      description: 'Fast, disk space efficient package manager',
      goodExamples: ['pnpm start', 'pnpm run build', 'pnpm test'],
      badExamples: ['pnpm script.js', 'pnpm execute start']
    },
    'ts-node': {
      description: 'TypeScript execution environment',
      goodExamples: ['ts-node script.ts', 'ts-node src/index.ts'],
      badExamples: ['ts-node script.js', 'ts-node script.py']
    },
    'tsc': {
      description: 'TypeScript compiler',
      goodExamples: ['tsc', 'tsc --project tsconfig.json'],
      badExamples: ['tsc script.ts', 'tsc run script.ts']
    },
    'bun': {
      description: 'JavaScript runtime, bundler, test runner, and package manager',
      goodExamples: ['bun run index.ts', 'bun run script.js', 'bun test'],
      badExamples: ['bun script.py', 'bun execute script.js']
    },
    // Python
    'python': {
      description: 'Python interpreter',
      goodExamples: ['python script.py', 'python -m pytest'],
      badExamples: ['python script.js', 'python script.ts']
    },
    'python3': {
      description: 'Python 3 interpreter',
      goodExamples: ['python3 script.py', 'python3 -m pytest'],
      badExamples: ['python3 script.js', 'python3 script.ts']
    },
    'pip': {
      description: 'Python package installer',
      goodExamples: ['pip install package', 'pip install -r requirements.txt'],
      badExamples: ['pip run script.py', 'pip execute script.py']
    },
    'pip3': {
      description: 'Python 3 package installer',
      goodExamples: ['pip3 install package', 'pip3 install -r requirements.txt'],
      badExamples: ['pip3 run script.py', 'pip3 execute script.py']
    },
    'poetry': {
      description: 'Python dependency management tool',
      goodExamples: ['poetry run python script.py', 'poetry install'],
      badExamples: ['poetry script.py', 'poetry python script.py']
    },
    'uv': {
      description: 'Python package installer and environment manager',
      goodExamples: ['uv run main.py', 'uv run my_script.py'],
      badExamples: ['uv run python my_script.py', 'uv run my_script.js']
    },
    'pytest': {
      description: 'Python testing framework',
      goodExamples: ['pytest', 'pytest tests/test_file.py'],
      badExamples: ['pytest run tests', 'pytest script.py']
    },
    'flask': {
      description: 'Python web framework command',
      goodExamples: ['flask run', 'flask --app app run'],
      badExamples: ['flask app.py', 'flask execute']
    },
    'django-admin': {
      description: 'Django command-line utility',
      goodExamples: ['django-admin startproject mysite', 'django-admin runserver'],
      badExamples: ['django-admin app.py', 'django-admin run app.py']
    },
    // Other build tools
    'make': {
      description: 'Build automation tool',
      goodExamples: ['make', 'make target'],
      badExamples: ['make run script', 'make execute']
    },
    'cmake': {
      description: 'Cross-platform build system generator',
      goodExamples: ['cmake .', 'cmake -B build'],
      badExamples: ['cmake run', 'cmake execute']
    },
    'bazel': {
      description: 'Build and test tool',
      goodExamples: ['bazel build //path/to:target', 'bazel test //...'],
      badExamples: ['bazel script.py', 'bazel execute']
    },
    'ninja': {
      description: 'Small build system focused on speed',
      goodExamples: ['ninja', 'ninja -C build'],
      badExamples: ['ninja run', 'ninja script.py']
    }
  };

  const availableCommands: SystemCommand[] = [];
  const commonCommands = Object.keys(commandsInfo);
  
  const checkPromises = commonCommands.map(async (command) => {
    try {
      const isAvailable = await isCommandAvailable(command);
      if (isAvailable) {
        let commandString = command;
        if (commandsInfo[command]) {
          let description = commandsInfo[command].description;
          let goodExamplesString = commandsInfo[command].goodExamples.join(', ');
          let badExamplesString = commandsInfo[command].badExamples.join(', ');
          commandString = `${command}: ${description} (Good usage examples: ${goodExamplesString}) (Bad usage examples: ${badExamplesString})\n`;
        }

        availableCommands.push({
          available: true,
          command_description: commandString
        });
      } else {
        availableCommands.push({ available: false, command_description: command });
      }
    } catch (error) {
      availableCommands.push({ available: false, command_description: command });
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
