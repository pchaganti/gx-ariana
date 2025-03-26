from setuptools import setup
import sys
import platform

setup(
    name='ariana',
    version='0.3.8',
    description='Debug your JS/TS/Python code in development way faster than with a traditional debugger',
    packages=['ariana'],
    package_data={
        'ariana': ['bin/ariana-linux-x64', 'bin/ariana-macos-x64', 'bin/ariana-macos-arm64', 'bin/ariana-windows-x64.exe'],
    },
    entry_points={
        'console_scripts': [
            'ariana = ariana:main',
        ],
    },
    license='AGPL-3.0-only',
    url='https://github.com/dedale-dev/ariana',
)
