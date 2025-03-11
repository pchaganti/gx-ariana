import os
import subprocess
import sys
import platform

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
        subprocess.run([binary] + sys.argv[1:], check=True)
    except subprocess.CalledProcessError as e:
        sys.exit(1)

if __name__ == '__main__':
    main()
