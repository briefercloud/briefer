import os
from shutil import copyfile
from setuptools import setup

# Custom function to copy files from the parent directory into the project directory
def copy_readme_and_license():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    if os.path.exists(os.path.join(project_root, "README.md")):
        copyfile(os.path.join(project_root, "README.md"), "README.md")
    if os.path.exists(os.path.join(project_root, "LICENSE")):
        copyfile(os.path.join(project_root, "LICENSE"), "LICENSE")

# Run the copy function
copy_readme_and_license()

# Call setuptools, but defer most configuration to pyproject.toml
setup()
