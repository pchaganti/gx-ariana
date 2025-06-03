#!/usr/bin/env node
const { execFileSync, spawnSync, spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');

const platform = os.platform();
const arch = os.arch();
const currentVersion = '0.5.0';

// Function to check for the latest version
function checkLatestVersion() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'registry.npmjs.org',
      path: '/ariana',
      method: 'GET',
      timeout: 3000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const packageInfo = JSON.parse(data);
          resolve(packageInfo['dist-tags']?.latest);
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => {
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

// Function to display version warning
async function checkVersionAndWarn() {
  try {
    const latestVersion = await checkLatestVersion();
    if (latestVersion && latestVersion !== '0.5.0') {
      console.log('\x1b[33m%s\x1b[0m', '\u26A0 WARNING: You are using an outdated version of Ariana CLI');
      console.log('\x1b[33m%s\x1b[0m', `Your version: 0.5.0`);
      console.log('\x1b[33m%s\x1b[0m', `Latest version: ${latestVersion}`);
      console.log('\x1b[33m%s\x1b[0m', 'Please update to the latest version using: npm install -g ariana@latest');
    }
  } catch (e) {
    // Silently fail if version check fails
  }
}

let binaryName;
if (platform === 'linux') {
  if (arch === 'arm64') {
    binaryName = 'ariana-linux-arm64';
  } else if (arch === 'x64') {
    binaryName = 'ariana-linux-x64';
  } else {
    console.error('Unsupported Linux architecture');
    process.exit(1);
  }
} else if (platform === 'darwin') {
  if (arch === 'arm64') {
    binaryName = 'ariana-macos-arm64';
  } else if (arch === 'x64') {
    binaryName = 'ariana-macos-x64';
  } else {
    console.error('Unsupported macOS architecture');
    process.exit(1);
  }
} else if (platform === 'win32' && arch === 'x64') {
  binaryName = 'ariana-windows-x64.exe';
} else {
  console.error('Unsupported platform or architecture');
  process.exit(1);
}

const binaryPath = path.join(__dirname, 'bin', binaryName);

// Print some diagnostic info
function printBinaryInfo() {
  console.log('Ariana binary information:');
  console.log(`Binary path: ${binaryPath}`);
  console.log(`Platform: ${platform}, Architecture: ${arch}`);
  try {
    const stats = fs.statSync(binaryPath);
    console.log(`Binary exists: Yes, Size: ${stats.size} bytes, Mode: ${stats.mode.toString(8)}`);
  } catch (err) {
    console.log(`Binary exists: No (${err.message})`);
  }
}

if (process.argv[2] === 'install') {
  // Set executable permissions on Unix-like systems
  if (platform === 'linux' || platform === 'darwin') {
    try {
      fs.chmodSync(binaryPath, 0o755);  // rwxr-xr-x
      console.log(`Set executable permissions on ${binaryPath}`);
    } catch (err) {
      console.warn(`Warning: Could not set execute permissions on ${binaryPath}: ${err.message}`);
      console.warn('The binary might already be executable or permissions might be restricted.');
      // Continue anyway, as the binary might still be executable
    }
  }
  
  // Print diagnostic info during install
  printBinaryInfo();
  
  console.log('ariana binary installed successfully');
  process.exit(0);
}

// Check for version updates (don't await to avoid blocking)
if (process.argv[2] !== 'version' && process.argv[2] !== '--version' && process.argv[2] !== '-v') {
  checkVersionAndWarn();
}

try {
  const args = process.argv.slice(2);
  
  // Use different execution strategies depending on platform
  if (platform === 'win32') {
    // On Windows, execFileSync works well
    try {
      execFileSync(binaryPath, args, { stdio: 'inherit' });
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  } else if (platform === 'darwin') {
    // On macOS, try various methods starting with the most reliable
    console.log(`Executing on macOS: ${binaryPath} with args: ${args.join(' ')}`);
    
    // Method 1: Try /usr/bin/env approach (works well with macOS security)
    try {
      const allArgs = [binaryPath].concat(args);
      const childProcess = spawn('/usr/bin/env', allArgs, {
        stdio: 'inherit'
      });
      
      childProcess.on('error', (err) => {
        console.warn(`Warning: /usr/bin/env method failed: ${err.message}`);
        console.warn('Trying alternate method...');
        
        // Method 2: Try with shell: true as fallback
        const shellProcess = spawn(binaryPath, args, {
          stdio: 'inherit',
          shell: true
        });
        
        shellProcess.on('error', (shellErr) => {
          console.error(`Error starting process with shell: ${shellErr.message}`);
          printBinaryInfo();
          process.exit(1);
        });
        
        shellProcess.on('exit', (code) => {
          process.exit(code || 0);
        });
      });
      
      childProcess.on('exit', (code) => {
        process.exit(code || 0);
      });
    } catch (err) {
      console.error(`All execution methods failed for macOS: ${err.message}`);
      printBinaryInfo();
      process.exit(1);
    }
  } else {
    // On Linux, use spawn with shell: true
    console.log(`Executing on Linux: ${binaryPath} with args: ${args.join(' ')}`);
    
    const childProcess = spawn(binaryPath, args, {
      stdio: 'inherit',
      shell: true
    });
    
    childProcess.on('error', (err) => {
      console.error(`Error starting process: ${err.message}`);
      printBinaryInfo();
      process.exit(1);
    });
    
    childProcess.on('exit', (code) => {
      process.exit(code || 0);
    });
  }
} catch (err) {
  console.error('Error running ariana:', err.message);
  printBinaryInfo();
  process.exit(1);
}
