#!/usr/bin/env python3

import os

def generate_color_component():
    # Path to the color variables file
    color_vars_path = os.path.join('resources', 'color_vars.txt')
    
    # Read all color variables
    with open(color_vars_path, 'r') as f:
        color_vars = [line.strip() for line in f.readlines() if line.strip()]
    
    # Generate the React component
    component = """
import React from 'react';

const ColorVisualizerTab: React.FC = () => {
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">VSCode Color Variables</h2>
      <div className="flex flex-wrap gap-4 justify-start">
"""
    
    # Add each color variable as a component
    for var_name in color_vars:
        component += f'''
        <div className="flex flex-col items-center mb-4">
          <div 
            className="w-16 h-16 rounded-md mb-2 border border-[var(--vscode-panel-border)]" 
            style={{ backgroundColor: 'var({var_name})' }}
          />
          <div className="text-xs text-center break-all max-w-[120px]">{var_name}</div>
        </div>
'''
    
    # Close the component
    component += """
      </div>
    </div>
  );
};

export default ColorVisualizerTab;
"""
    
    # Write the component to a file
    output_path = os.path.join('webview-ui', 'src', 'components', 'ColorVisualizerTab.tsx')
    with open(output_path, 'w') as f:
        f.write(component)
    
    print(f"Generated component written to {output_path}")

if __name__ == "__main__":
    generate_color_component()
