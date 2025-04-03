import json
import shutil
import subprocess
from pathlib import Path

PACKAGE_JSON = Path("package.json")
ORIGINAL_PACKAGE_JSON = Path("package.json.bak")
OUTPUT_DIR = Path("packaged/openvsx")
VSIX_NAME = "ariana-openvsx.vsix"

def modify_package_json():
    """Modify package.json to change the publisher to 'ariana'."""
    with PACKAGE_JSON.open("r", encoding="utf-8") as f:
        data = json.load(f)
    
    # Backup original package.json
    shutil.copy(PACKAGE_JSON, ORIGINAL_PACKAGE_JSON)
    
    # Modify publisher
    data["publisher"] = "ariana"
    
    with PACKAGE_JSON.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def restore_package_json():
    """Restore the original package.json."""
    if ORIGINAL_PACKAGE_JSON.exists():
        shutil.move(ORIGINAL_PACKAGE_JSON, PACKAGE_JSON)

def package_extension():
    """Run the vsce package command and move output to the target directory."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Run VSCE package
    subprocess.run(["C:\\Users\\mr003\\AppData\\Local\\pnpm\\vsce.cmd", "package", "--out", VSIX_NAME], check=True)
    
    # Move .vsix to the correct location
    shutil.move(VSIX_NAME, OUTPUT_DIR / VSIX_NAME)

def main():
    try:
        modify_package_json()
        package_extension()
    finally:
        restore_package_json()
    print(f"Packaged VSIX saved to {OUTPUT_DIR / VSIX_NAME}")

if __name__ == "__main__":
    main()
