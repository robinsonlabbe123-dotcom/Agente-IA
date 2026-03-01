#!/usr/bin/env python3
"""
CLI entry point for AppGeneratorAgent.

Usage
-----
    python main.py "A task management app with user authentication"
    python main.py "E-commerce platform" --provider anthropic --output ./projects
"""

import argparse
import os
import sys

from agent import AppGeneratorAgent


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="app-generator",
        description="Generate a full-stack project scaffold from a plain-language app idea.",
    )
    parser.add_argument(
        "idea",
        help="Description of the application to generate (wrap in quotes).",
    )
    parser.add_argument(
        "--provider",
        choices=["openai", "anthropic"],
        default="openai",
        help="LLM provider to use (default: openai).",
    )
    parser.add_argument(
        "--output",
        default=".",
        help="Directory where the new project folder will be created (default: current directory).",
    )
    args = parser.parse_args()

    # Resolve API key from environment
    env_key = "OPENAI_API_KEY" if args.provider == "openai" else "ANTHROPIC_API_KEY"
    api_key = os.environ.get(env_key, "").strip()

    if not api_key:
        sys.exit(
            f"Error: environment variable {env_key!r} is not set.\n"
            f"Set it before running:\n"
            f"  export {env_key}=your_api_key_here"
        )

    agent = AppGeneratorAgent(api_key=api_key, provider=args.provider)
    project_path = agent.generate_app(app_idea=args.idea, output_dir=args.output)
    print(f"\nDone! Your project is ready at:\n  {project_path}")


if __name__ == "__main__":
    main()
