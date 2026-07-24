import os
from setuptools import setup

HERE = os.path.dirname(os.path.abspath(__file__))


def _local(path: str) -> str:
    return f"file://{os.path.join(HERE, path)}"


setup(
    name="persona-platform-cli",
    version="0.1.0",
    py_modules=["cli"],
    install_requires=[
        _local("shared"),
        _local("persona-swap-core"),
        _local("sdk"),
    ],
    entry_points={
        "console_scripts": [
            "persona=cli:main",
        ],
    },
)