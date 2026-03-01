"""
AppGeneratorAgent — AI-powered app scaffold generator.

Supports OpenAI (default) and Anthropic as LLM providers.
Given a plain-language app idea it will:
  1. Generate a README.md describing the project architecture.
  2. Generate a base HTML/Tailwind CSS frontend (index.html).
  3. Generate a base FastAPI backend (main.py + requirements.txt).
  4. Save every file inside a new project folder.
"""

from __future__ import annotations

import os
import re
import textwrap
from pathlib import Path
from typing import Dict


# ---------------------------------------------------------------------------
# Provider clients (imported lazily so only the one that is used is required)
# ---------------------------------------------------------------------------

def _openai_client(api_key: str):
    from openai import OpenAI  # type: ignore
    return OpenAI(api_key=api_key)


def _anthropic_client(api_key: str):
    import anthropic  # type: ignore
    return anthropic.Anthropic(api_key=api_key)


# ---------------------------------------------------------------------------
# AppGeneratorAgent
# ---------------------------------------------------------------------------

class AppGeneratorAgent:
    """Generates a ready-to-use project scaffold from a single app idea."""

    OPENAI_MODEL = "gpt-4o"
    ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022"

    def __init__(self, api_key: str, provider: str = "openai") -> None:
        """
        Parameters
        ----------
        api_key:
            API key for the chosen LLM provider.
        provider:
            ``"openai"`` (default) or ``"anthropic"``.
        """
        provider = provider.lower()
        if provider not in ("openai", "anthropic"):
            raise ValueError(f"Unsupported provider '{provider}'. Choose 'openai' or 'anthropic'.")

        self.provider = provider
        self._api_key = api_key
        self._client = (
            _openai_client(api_key) if provider == "openai" else _anthropic_client(api_key)
        )

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def generate_app(self, app_idea: str, output_dir: str = ".") -> str:
        """
        Orchestrate the full project generation.

        Parameters
        ----------
        app_idea:
            A short description of the application to build.
        output_dir:
            Parent directory where the new project folder will be created.
            Defaults to the current working directory.

        Returns
        -------
        str
            Absolute path of the newly created project folder.
        """
        if not app_idea.strip():
            raise ValueError("app_idea must not be empty.")

        print(f"[AppGeneratorAgent] Analyzing idea: {app_idea!r}")

        # Step 1 – Architecture & README
        print("[AppGeneratorAgent] Generating README.md …")
        readme_content = self._generate_readme(app_idea)

        # Step 2 – Frontend
        print("[AppGeneratorAgent] Generating frontend (index.html) …")
        frontend_content = self._generate_frontend(app_idea, readme_content)

        # Step 3 – Backend
        print("[AppGeneratorAgent] Generating backend (main.py) …")
        backend_content = self._generate_backend(app_idea, readme_content)

        # Step 4 – Backend requirements
        print("[AppGeneratorAgent] Generating backend requirements.txt …")
        backend_requirements = self._generate_backend_requirements(app_idea, backend_content)

        # Step 5 – Save files
        project_name = self._slugify(app_idea)
        files: Dict[str, str] = {
            "README.md": readme_content,
            "frontend/index.html": frontend_content,
            "backend/main.py": backend_content,
            "backend/requirements.txt": backend_requirements,
        }
        project_path = self._save_project(project_name, files, output_dir)
        print(f"[AppGeneratorAgent] Project created at: {project_path}")
        return project_path

    # ------------------------------------------------------------------
    # Private generation helpers
    # ------------------------------------------------------------------

    def _generate_readme(self, app_idea: str) -> str:
        prompt = textwrap.dedent(f"""
            You are a senior software architect.
            The user wants to build the following application:

            "{app_idea}"

            Write a comprehensive README.md for this project.
            Include:
            - Project title and description
            - Key features (bullet list)
            - Proposed tech stack (frontend: HTML + Tailwind CSS; backend: Python/FastAPI)
            - Folder structure (ASCII tree)
            - Setup & run instructions
            - API endpoints overview (brief table)

            Use clean Markdown. Do NOT include any preamble like "Here is the README".
        """).strip()

        return self._call_llm(prompt)

    def _generate_frontend(self, app_idea: str, architecture: str) -> str:
        prompt = textwrap.dedent(f"""
            You are a senior frontend developer.
            Build a single-file HTML page for the following application:

            "{app_idea}"

            Architecture context:
            {architecture[:1500]}

            Requirements:
            - Use Tailwind CSS via CDN (https://cdn.tailwindcss.com).
            - Include a navigation bar, a hero section, and a main content area.
            - Add a simple form or interactive element relevant to the app.
            - Use vanilla JavaScript (no frameworks) for any interactivity.
            - The page must be self-contained (single HTML file).
            - Return ONLY the raw HTML. No explanations, no markdown fences.
        """).strip()

        return self._call_llm(prompt)

    def _generate_backend(self, app_idea: str, architecture: str) -> str:
        prompt = textwrap.dedent(f"""
            You are a senior Python backend developer.
            Create a FastAPI application skeleton for the following application:

            "{app_idea}"

            Architecture context:
            {architecture[:1500]}

            Requirements:
            - Use FastAPI with CORS enabled for all origins (development mode).
            - Define at least 3 relevant API endpoints (GET / POST / etc.) with Pydantic models.
            - Include brief docstrings on each endpoint.
            - Add a root endpoint GET / that returns a health-check JSON.
            - Return ONLY the raw Python source code. No explanations, no markdown fences.
        """).strip()

        return self._call_llm(prompt)

    def _generate_backend_requirements(self, app_idea: str, backend_code: str) -> str:
        prompt = textwrap.dedent(f"""
            Given the following FastAPI application code for "{app_idea}":

            {backend_code[:2000]}

            Generate a minimal requirements.txt that lists all Python packages used,
            one per line with pinned major versions (e.g. fastapi>=0.110,<1).
            Always include: fastapi, uvicorn[standard], pydantic.
            Return ONLY the raw requirements.txt content. No explanations.
        """).strip()

        return self._call_llm(prompt)

    # ------------------------------------------------------------------
    # LLM call abstraction
    # ------------------------------------------------------------------

    def _call_llm(self, prompt: str) -> str:
        """Send a prompt to the configured LLM provider and return the text."""
        if self.provider == "openai":
            return self._call_openai(prompt)
        return self._call_anthropic(prompt)

    def _call_openai(self, prompt: str) -> str:
        response = self._client.chat.completions.create(
            model=self.OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()

    def _call_anthropic(self, prompt: str) -> str:
        message = self._client.messages.create(
            model=self.ANTHROPIC_MODEL,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text.strip()

    # ------------------------------------------------------------------
    # File system helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _slugify(text: str) -> str:
        """Convert an arbitrary string into a filesystem-safe folder name."""
        slug = text.lower().strip()
        slug = re.sub(r"[^\w\s-]", "", slug)
        slug = re.sub(r"[\s_-]+", "-", slug)
        slug = slug[:60].strip("-")
        return slug or "generated-app"

    @staticmethod
    def _save_project(project_name: str, files: Dict[str, str], output_dir: str) -> str:
        """
        Write every entry in *files* into ``output_dir/project_name/``.

        Parameters
        ----------
        project_name:
            Slug used as the top-level project folder name.
        files:
            Mapping of relative path → file content.
        output_dir:
            Parent directory that already exists (or will be created).

        Returns
        -------
        str
            Absolute path of the project root folder.
        """
        base = Path(output_dir).resolve() / project_name
        base.mkdir(parents=True, exist_ok=True)

        for relative_path, content in files.items():
            target = base / relative_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            print(f"  ✔ {relative_path}")

        return str(base)
