"""
Setup script for Anki Taskbar
"""

from setuptools import setup, find_packages
import os

# Read the version from __version__.py
def get_version():
    version_file = os.path.join(os.path.dirname(__file__), '__version__.py')
    with open(version_file, 'r') as f:
        exec(f.read())
    return locals()['__version__']

# Read the README file
def get_long_description():
    readme_file = os.path.join(os.path.dirname(__file__), 'README.md')
    if os.path.exists(readme_file):
        with open(readme_file, 'r', encoding='utf-8') as f:
            return f.read()
    return "A modern task management interface for Anki"

setup(
    name="anki-taskbar",
    version=get_version(),
    author="Agampodige",
    author_email="",
    description="A modern task management interface for Anki",
    long_description=get_long_description(),
    long_description_content_type="text/markdown",
    url="https://github.com/Agampodige/anki_task_bar",
    packages=find_packages(),
    include_package_data=True,
    package_data={
        "anki_task_bar": [
            "web/*",
            "web/assets/*",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Education",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Education",
        "Topic :: Utilities",
    ],
    python_requires=">=3.8",
    install_requires=[
        "PyQt6>=6.0.0",
        "PyQt6-WebEngine>=6.0.0",
    ],
    keywords="anki task management productivity flashcards",
    project_urls={
        "Bug Reports": "https://github.com/Agampodige/anki_task_bar/issues",
        "Source": "https://github.com/Agampodige/anki_task_bar",
        "Changelog": "https://github.com/Agampodige/anki_task_bar/blob/main/CHANGELOG.md",
    },
)
