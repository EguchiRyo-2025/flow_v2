"""
Flow Designer - デジタル作業台フロー設計システム
"""
from setuptools import setup, find_packages

setup(
    name="flow-designer",
    version="0.1.0",
    description="デジタル作業台のフロー設計・実行システム",
    author="Your Team",
    python_requires=">=3.8",
    packages=find_packages(exclude=["tests", "tests.*"]),
    install_requires=[
        "Flask>=2.0.0",
        "Flask-CORS>=3.0.10",
        "SQLAlchemy>=1.4.0",
        "python-dotenv>=0.19.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=3.0.0",
            "black>=22.0.0",
            "flake8>=4.0.0",
        ],
        "postgresql": [
            "psycopg2-binary>=2.9.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "flow-designer=core.app:main",
        ],
    },
)
