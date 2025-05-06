import os
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
            return data.get("info", {}).get("version")
    except (URLError, json.JSONDecodeError, KeyError) as e:
        print(f"Warning: Failed to check for latest version: {e}")
        return None

def main():
    module_dir = os.path.dirname(__file__)
    binary_dir = os.path.join(module_dir, 'bin')
    system = platform.system().lower()
    machine = platform.machine().lower()

    if system == 'linux':
        if 'aarch64' in machine or 'arm64' in machine:
            binary = os.path.join(binary_dir, 'ariana-linux-arm64')
        elif 'x86_64' in machine:
            binary = os.path.join(binary_dir, 'ariana-linux-x64')
        else:
            print("Unsupported Linux architecture")
            sys.exit(1)
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
        print(f"Error: Binary file not found at {binary}")
        print("This may be due to a packaging issue or incomplete installation.")
        print("Please try reinstalling the package with: pip install --force-reinstall ariana")
        sys.exit(1)

    if system in ['linux', 'darwin']:
        try:
            os.chmod(binary, 0o755)
        except Exception as e:
            print(f"Warning: Could not set execute permissions on {binary}: {e}")
            # Continue anyway, the binary might already be executable

    try:
        latest_version = check_latest_version()
        if latest_version and latest_version != '0.4.7':
            print('\033[33m\u26A0  WARNING: You are using an outdated version of Ariana CLI\033[0m')
            print(f'\033[33mYour version: 0.4.7\033[0m')
            print(f'\033[33mLatest version: {latest_version}\033[0m')
            print('\033[33mPlease update to the latest version using: pip install --upgrade ariana\033[0m')
    except Exception:
        # Silently fail if version check fails
        pass

    try:
        subprocess.run([binary] + sys.argv[1:], check=True)
    except subprocess.CalledProcessError as e:
        sys.exit(1)

if __name__ == '__main__':
    main()
