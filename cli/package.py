import os
import shutil
import sys
import platform
import subprocess
import re
import json
import urllib.request
from urllib.error import URLError

# Configuration
BINARY_DIR = "binaries"  # Directory containing your prebuilt Rust binaries
NPM_DIR = "ariana-npm"
PIP_DIR = "ariana-py"
BINARIES = {
    "linux": "ariana-linux-x64",
    "macos-x64": "ariana-macos-x64",
    "macos-arm64": "ariana-macos-arm64",
    "windows": "ariana-windows-x64.exe",
}
VSCODE_README_PATH = "../extensions/vscode/README.md"  # Path to the VS Code extension README

# Function to check for the latest version
def get_latest_version(package_type):
    try:
        if package_type == "npm":
            url = "https://registry.npmjs.org/ariana"
            with urllib.request.urlopen(url, timeout=3) as response:
                data = json.loads(response.read().decode())
                return data.get("dist-tags", {}).get("latest")
        elif package_type == "pip":
            url = "https://pypi.org/pypi/ariana/json"
            with urllib.request.urlopen(url, timeout=3) as response:
                data = json.loads(response.read().decode())
                return data.get("info", {}).get("version")
        return None
    except (URLError, json.JSONDecodeError, KeyError) as e:
        print(f"Warning: Failed to check for latest version: {e}")
        return None

# Helper function to set executable permissions using Git Bash on Windows
def set_executable_with_git_bash(file_path):
    try:
        # Convert Windows path to Git Bash compatible path
        git_bash_path = file_path.replace('\\', '/')
        # Check if the path starts with a drive letter and convert it to Git Bash format
        if re.match(r'^[A-Za-z]:', git_bash_path):
            drive_letter = git_bash_path[0].lower()
            git_bash_path = f"/{drive_letter}{git_bash_path[2:]}"
        
        print(f"Attempting to set executable permissions using Git Bash on {file_path}")
        result = subprocess.run(
            ["bash", "-c", f"chmod 755 '{git_bash_path}'"], 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            text=True
        )
        if result.returncode == 0:
            print("Successfully set executable permissions using Git Bash")
            return True
        else:
            print(f"Warning: Git Bash chmod failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"Warning: Could not set executable permissions using Git Bash: {e}")
        print("This is normal on Windows and should not affect functionality.")
        return False

# Get version from Cargo.toml
def get_version_from_cargo():
    cargo_path = "Cargo.toml"
    try:
        with open(cargo_path, 'r') as f:
            content = f.read()
            version_match = re.search(r'version\s*=\s*"([^"]+)"', content)
            if version_match:
                return version_match.group(1)
            else:
                print("Warning: Could not find version in Cargo.toml, using default")
                return "0.1.0"
    except Exception as e:
        print(f"Error reading Cargo.toml: {e}")
        return "0.1.0"

# Get version
VERSION = get_version_from_cargo()

# Ensure the script is run from the correct directory
def ensure_dir(directory):
    os.makedirs(directory, exist_ok=True)

# Copy binary to target directory with executable permissions
def copy_binary(src, dst):
    shutil.copy(src, dst)
    
    if platform.system().lower() != "windows":
        try:
            # Make sure to set executable permissions for user, group, and others on Unix-like systems
            os.chmod(dst, 0o755)  # rwxr-xr-x
            print(f"Set executable permissions (0755) on {dst}")
        except Exception as e:
            print(f"Warning: Could not set executable permissions on {dst}: {e}")
            print("Binary may not be executable after installation.")
    else:
        # On Windows, try to use Git Bash's chmod
        set_executable_with_git_bash(dst)

# Helper function to create placeholder binaries
def create_placeholder_binary(platform_key, output_path):
    if not platform_key == "windows":
        # For non-Windows platforms, create a shell script
        with open(output_path, 'w') as f:
            f.write(f'''#!/bin/bash
echo "Error: This is a placeholder binary for {platform_key}."
echo "Cross-compilation failed when building this package."
echo "Please check build logs for more information."
exit 1
''')
        try:
            os.chmod(output_path, 0o755)
        except Exception as chmod_err:
            print(f"Warning: Could not set executable permissions on placeholder: {chmod_err}")
    else:
        # For Windows, create a batch file
        with open(output_path, 'w') as f:
            f.write(f'''@echo off
echo Error: This is a placeholder binary for {platform_key}.
echo Cross-compilation failed when building this package.
echo Please check build logs for more information.
exit /b 1
''')
    print(f"Created placeholder for {platform_key}")

# Get the current platform
def get_platform():
    system = platform.system().lower()
    machine = platform.machine().lower()
    if system == "linux":
        return "linux"
    elif system == "darwin":
        if "arm64" in machine:
            return "macos-arm64"
        else:
            return "macos-x64"
    else:
        return "windows"

# Create npm package
def create_npm_package():
    ensure_dir(NPM_DIR)
    bin_dir = os.path.join(NPM_DIR, "bin")
    ensure_dir(bin_dir)

    # Copy binaries
    for key, binary in BINARIES.items():
        src = os.path.join(BINARY_DIR, binary)
        if os.path.exists(src):
            copy_binary(src, os.path.join(bin_dir, binary))

    # Write package.json
    with open(os.path.join(NPM_DIR, "package.json"), "w") as f:
        f.write(f'''{{
  "name": "ariana",
  "version": "{VERSION}",
  "description": "Debug your JS/TS/Python code in development way faster than with a traditional debugger",
  "license": "AGPL-3.0-only",
  "repository": {{
    "type": "git",
    "url": "https://github.com/dedale-dev/ariana.git"
  }},
  "homepage": "https://ariana.dev",
  "bin": {{
    "ariana": "./ariana.js"
  }},
  "keywords": [
    "debugging",
    "ai",
    "typescript",
    "javascript",
    "nodejs",
    "python",
    "react"
  ],
  "scripts": {{
    "postinstall": "node ./ariana.js install"
  }},
  "files": [
    "bin",
    "bin/ariana-linux-x64",
    "bin/ariana-macos-x64",
    "bin/ariana-macos-arm64",
    "bin/ariana-windows-x64.exe",
    "ariana.js"
  ]
}}
''')

    # Write ariana.js in the root directory, not in bin
    with open(os.path.join(NPM_DIR, "ariana.js"), "w") as f:
        f.write(f'''#!/usr/bin/env node

const {{ execFileSync, spawnSync, spawn }} = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');

const platform = os.platform();
const arch = os.arch();
const currentVersion = '{VERSION}';

// Function to check for the latest version
function checkLatestVersion() {{
  return new Promise((resolve) => {{
    const options = {{
      hostname: 'registry.npmjs.org',
      path: '/ariana',
      method: 'GET',
      timeout: 3000
    }};

    const req = https.request(options, (res) => {{
      let data = '';
      res.on('data', (chunk) => {{
        data += chunk;
      }});
      res.on('end', () => {{
        try {{
          const packageInfo = JSON.parse(data);
          resolve(packageInfo['dist-tags']?.latest);
        }} catch (e) {{
          resolve(null);
        }}
      }});
    }});

    req.on('error', () => {{
      resolve(null);
    }});

    req.on('timeout', () => {{
      req.destroy();
      resolve(null);
    }});

    req.end();
  }});
}}

// Function to display version warning
async function checkVersionAndWarn() {{
  try {{
    const latestVersion = await checkLatestVersion();
    if (latestVersion && latestVersion !== '{VERSION}') {{
      console.log('\\x1b[33m%s\\x1b[0m', '⚠️  WARNING: You are using an outdated version of Ariana CLI');
      console.log('\\x1b[33m%s\\x1b[0m', `Your version: {VERSION}`);
      console.log('\\x1b[33m%s\\x1b[0m', `Latest version: ${{latestVersion}}`);
      console.log('\\x1b[33m%s\\x1b[0m', 'Please update to the latest version using: npm install -g ariana@latest');
    }}
  }} catch (e) {{
    // Silently fail if version check fails
  }}
}}

let binaryName;
if (platform === 'linux' && arch === 'x64') {{
  binaryName = 'ariana-linux-x64';
}} else if (platform === 'darwin') {{
  if (arch === 'arm64') {{
    binaryName = 'ariana-macos-arm64';
  }} else if (arch === 'x64') {{
    binaryName = 'ariana-macos-x64';
  }} else {{
    console.error('Unsupported macOS architecture');
    process.exit(1);
  }}
}} else if (platform === 'win32' && arch === 'x64') {{
  binaryName = 'ariana-windows-x64.exe';
}} else {{
  console.error('Unsupported platform or architecture');
  process.exit(1);
}}

const binaryPath = path.join(__dirname, 'bin', binaryName);

// Print some diagnostic info
function printBinaryInfo() {{
  console.log('Ariana binary information:');
  console.log(`Binary path: ${{binaryPath}}`);
  console.log(`Platform: ${{platform}}, Architecture: ${{arch}}`);
  try {{
    const stats = fs.statSync(binaryPath);
    console.log(`Binary exists: Yes, Size: ${{stats.size}} bytes, Mode: ${{stats.mode.toString(8)}}`);
  }} catch (err) {{
    console.log(`Binary exists: No (${{err.message}})`);
  }}
}}

if (process.argv[2] === 'install') {{
  // Set executable permissions on Unix-like systems
  if (platform === 'linux' || platform === 'darwin') {{
    try {{
      fs.chmodSync(binaryPath, 0o755);  // rwxr-xr-x
      console.log(`Set executable permissions on ${{binaryPath}}`);
    }} catch (err) {{
      console.warn(`Warning: Could not set execute permissions on ${{binaryPath}}: ${{err.message}}`);
      console.warn('The binary might already be executable or permissions might be restricted.');
      // Continue anyway, as the binary might still be executable
    }}
  }}
  
  // Print diagnostic info during install
  printBinaryInfo();
  
  console.log('ariana binary installed successfully');
  process.exit(0);
}}

// Check for version updates (don't await to avoid blocking)
if (process.argv[2] !== 'version' && process.argv[2] !== '--version' && process.argv[2] !== '-v') {{
  checkVersionAndWarn();
}}

try {{
  const args = process.argv.slice(2);
  
  // Use different execution strategies depending on platform
  if (platform === 'win32') {{
    // On Windows, execFileSync works well
    try {{
      execFileSync(binaryPath, args, {{ stdio: 'inherit' }});
    }} catch (err) {{
      console.error(err.message);
      process.exit(1);
    }}
  }} else if (platform === 'darwin') {{
    // On macOS, try various methods starting with the most reliable
    console.log(`Executing on macOS: ${{binaryPath}} with args: ${{args.join(' ')}}`);
    
    // Method 1: Try /usr/bin/env approach (works well with macOS security)
    try {{
      const allArgs = [binaryPath].concat(args);
      const childProcess = spawn('/usr/bin/env', allArgs, {{
        stdio: 'inherit'
      }});
      
      childProcess.on('error', (err) => {{
        console.warn(`Warning: /usr/bin/env method failed: ${{err.message}}`);
        console.warn('Trying alternate method...');
        
        // Method 2: Try with shell: true as fallback
        const shellProcess = spawn(binaryPath, args, {{
          stdio: 'inherit',
          shell: true
        }});
        
        shellProcess.on('error', (shellErr) => {{
          console.error(`Error starting process with shell: ${{shellErr.message}}`);
          printBinaryInfo();
          process.exit(1);
        }});
        
        shellProcess.on('exit', (code) => {{
          process.exit(code || 0);
        }});
      }});
      
      childProcess.on('exit', (code) => {{
        process.exit(code || 0);
      }});
    }} catch (err) {{
      console.error(`All execution methods failed for macOS: ${{err.message}}`);
      printBinaryInfo();
      process.exit(1);
    }}
  }} else {{
    // On Linux, use spawn with shell: true
    console.log(`Executing on Linux: ${{binaryPath}} with args: ${{args.join(' ')}}`);
    
    const childProcess = spawn(binaryPath, args, {{
      stdio: 'inherit',
      shell: true
    }});
    
    childProcess.on('error', (err) => {{
      console.error(`Error starting process: ${{err.message}}`);
      printBinaryInfo();
      process.exit(1);
    }});
    
    childProcess.on('exit', (code) => {{
      process.exit(code || 0);
    }});
  }}
}} catch (err) {{
  console.error('Error running ariana:', err.message);
  printBinaryInfo();
  process.exit(1);
}}
'''.replace('{VERSION}', VERSION))

    if platform.system().lower() != "windows":
        os.chmod(os.path.join(NPM_DIR, "ariana.js"), 0o755)
    else:
        # On Windows, try to use Git Bash's chmod
        set_executable_with_git_bash(os.path.join(NPM_DIR, "ariana.js"))
    
    print(f"npm package created in {NPM_DIR}. Run 'npm publish' from there to upload.")

# Create pip package
def create_pip_package():
    ensure_dir(PIP_DIR)
    pkg_dir = os.path.join(PIP_DIR, "ariana")
    bin_dir = os.path.join(pkg_dir, "bin")
    ensure_dir(bin_dir)

    # Copy binaries
    for key, binary in BINARIES.items():
        src = os.path.join(BINARY_DIR, binary)
        if os.path.exists(src):
            copy_binary(src, os.path.join(bin_dir, binary))

    # Write __init__.py
    with open(os.path.join(pkg_dir, "__init__.py"), "w") as f:
        f.write(f'''import os
import subprocess
import sys
import platform
import json
import urllib.request
from urllib.error import URLError

def check_latest_version():
    try:
        url = "https://pypi.org/pypi/ariana/json"
        with urllib.request.urlopen(url, timeout=3) as response:
            data = json.loads(response.read().decode())
            return data.get("info", {{}}).get("version")
    except (URLError, json.JSONDecodeError, KeyError) as e:
        print(f"Warning: Failed to check for latest version: {{e}}")
        return None

def main():
    module_dir = os.path.dirname(__file__)
    binary_dir = os.path.join(module_dir, 'bin')
    system = platform.system().lower()
    machine = platform.machine().lower()

    if system == 'linux' and 'x86_64' in machine:
        binary = os.path.join(binary_dir, 'ariana-linux-x64')
    elif system == 'darwin':
        if 'x86_64' in machine:
            binary = os.path.join(binary_dir, 'ariana-macos-x64')
        elif 'arm64' in machine:
            binary = os.path.join(binary_dir, 'ariana-macos-arm64')
        else:
            print("Unsupported macOS architecture")
            sys.exit(1)
    elif system == 'windows' and ('x86_64' in machine or 'amd64' in machine):
        binary = os.path.join(binary_dir, 'ariana-windows-x64.exe')
    else:
        print("Unsupported platform or architecture")
        sys.exit(1)

    if not os.path.exists(binary):
        print(f"Error: Binary file not found at {{binary}}")
        print("This may be due to a packaging issue or incomplete installation.")
        print("Please try reinstalling the package with: pip install --force-reinstall ariana")
        sys.exit(1)

    if system in ['linux', 'darwin']:
        try:
            os.chmod(binary, 0o755)
        except Exception as e:
            print(f"Warning: Could not set execute permissions on {{binary}}: {{e}}")
            # Continue anyway, the binary might already be executable

    try:
        latest_version = check_latest_version()
        if latest_version and latest_version != '{VERSION}':
            print('\\033[33m\\u26A0  WARNING: You are using an outdated version of Ariana CLI\\033[0m')
            print(f'\\033[33mYour version: {{VERSION}}\\033[0m')
            print(f'\\033[33mLatest version: {{latest_version}}\\033[0m')
            print('\\033[33mPlease update to the latest version using: pip install --upgrade ariana\\033[0m')
    except Exception:
        # Silently fail if version check fails
        pass

    try:
        subprocess.run([binary] + sys.argv[1:], check=True)
    except subprocess.CalledProcessError as e:
        sys.exit(1)

if __name__ == '__main__':
    main()
'''.replace('{VERSION}', VERSION))

    # Write setup.py
    with open(os.path.join(PIP_DIR, "setup.py"), "w") as f:
        f.write(f'''from setuptools import setup
import sys
import platform

setup(
    name='ariana',
    version='{VERSION}',
    description='Debug your JS/TS/Python code in development way faster than with a traditional debugger',
    packages=['ariana'],
    package_data={{
        'ariana': ['bin/ariana-linux-x64', 'bin/ariana-macos-x64', 'bin/ariana-macos-arm64', 'bin/ariana-windows-x64.exe'],
    }},
    entry_points={{
        'console_scripts': [
            'ariana = ariana:main',
        ],
    }},
    license='AGPL-3.0-only',
    url='https://github.com/dedale-dev/ariana',
)
'''.replace('{VERSION}', VERSION))

    print(f"pip package created in {PIP_DIR}. Run 'python -m build' and 'twine upload dist/*' to upload.")

# Copy README.md from VS Code extension to npm and pip packages
def copy_readme():
    print("Copying README.md from VS Code extension...")
    if not os.path.exists(VSCODE_README_PATH):
        print(f"Error: VS Code README not found at {VSCODE_README_PATH}")
        return False

    # Copy to npm package
    npm_readme_path = os.path.join(NPM_DIR, "README.md")
    shutil.copy(VSCODE_README_PATH, npm_readme_path)
    print(f"README.md copied to {npm_readme_path}")

    # Copy to pip package
    pip_readme_path = os.path.join(PIP_DIR, "README.md")
    shutil.copy(VSCODE_README_PATH, pip_readme_path)
    print(f"README.md copied to {pip_readme_path}")
    
    return True

# Main execution
def main():    
    if not os.path.exists(BINARY_DIR):
        print(f"Error: Directory '{BINARY_DIR}' with binaries not found.")
        sys.exit(1)

    print("Creating npm package...")
    create_npm_package()
    print("Creating pip package...")
    create_pip_package()
    
    print("Copying README files...")
    copy_readme()
    
    print("\nNext steps:")
    print(f"- For npm: cd {NPM_DIR} && npm login && npm publish --access public")
    print(f"- For pip: cd {PIP_DIR} && python -m pip install build twine && python -m build && twine upload dist/*")

if __name__ == "__main__":
    main()