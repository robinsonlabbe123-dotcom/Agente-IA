"""
Tests for AppGeneratorAgent.

These tests mock the LLM providers so no real API key is required.
Run with:  python -m pytest tests/ -v
"""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from agent import AppGeneratorAgent


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

FAKE_README = "# My App\n\nGreat app.\n\n## Features\n- Feature 1"
FAKE_HTML = "<!DOCTYPE html><html><head><title>App</title></head><body><h1>Hello</h1></body></html>"
FAKE_BACKEND = "from fastapi import FastAPI\napp = FastAPI()\n\n@app.get('/')\ndef root():\n    return {'status': 'ok'}"
FAKE_REQUIREMENTS = "fastapi>=0.110,<1\nuvicorn[standard]>=0.29,<1\npydantic>=2.0,<3"


def _mock_openai_response(text: str) -> MagicMock:
    """Return a minimal mock that looks like an OpenAI chat completion response."""
    choice = MagicMock()
    choice.message.content = text
    response = MagicMock()
    response.choices = [choice]
    return response


def _mock_anthropic_response(text: str) -> MagicMock:
    """Return a minimal mock that looks like an Anthropic message response."""
    content_block = MagicMock()
    content_block.text = text
    response = MagicMock()
    response.content = [content_block]
    return response


# ---------------------------------------------------------------------------
# AppGeneratorAgent.__init__
# ---------------------------------------------------------------------------

class TestInit:
    def test_default_provider_is_openai(self):
        with patch("agent._openai_client", return_value=MagicMock()):
            agent = AppGeneratorAgent(api_key="sk-test")
        assert agent.provider == "openai"

    def test_anthropic_provider_accepted(self):
        with patch("agent._anthropic_client", return_value=MagicMock()):
            agent = AppGeneratorAgent(api_key="sk-ant-test", provider="anthropic")
        assert agent.provider == "anthropic"

    def test_invalid_provider_raises(self):
        with pytest.raises(ValueError, match="Unsupported provider"):
            AppGeneratorAgent(api_key="key", provider="cohere")

    def test_empty_api_key_accepted_at_construction(self):
        """The agent should not validate the key at construction time."""
        with patch("agent._openai_client", return_value=MagicMock()):
            agent = AppGeneratorAgent(api_key="")
        assert agent._api_key == ""


# ---------------------------------------------------------------------------
# AppGeneratorAgent._slugify
# ---------------------------------------------------------------------------

class TestSlugify:
    def test_basic_slug(self):
        assert AppGeneratorAgent._slugify("My Cool App") == "my-cool-app"

    def test_special_chars_removed(self):
        slug = AppGeneratorAgent._slugify("App! With #special @chars")
        assert slug == "app-with-special-chars"

    def test_empty_string_returns_default(self):
        assert AppGeneratorAgent._slugify("") == "generated-app"

    def test_slug_max_length(self):
        long_idea = "a" * 100
        slug = AppGeneratorAgent._slugify(long_idea)
        assert len(slug) <= 60

    def test_spaces_become_hyphens(self):
        assert AppGeneratorAgent._slugify("hello world app") == "hello-world-app"


# ---------------------------------------------------------------------------
# AppGeneratorAgent._save_project
# ---------------------------------------------------------------------------

class TestSaveProject:
    def test_creates_folder_and_files(self, tmp_path):
        files = {
            "README.md": "# Hello",
            "frontend/index.html": "<html></html>",
            "backend/main.py": "print('hi')",
        }
        result = AppGeneratorAgent._save_project("my-app", files, str(tmp_path))
        project_dir = Path(result)

        assert project_dir.exists()
        assert (project_dir / "README.md").read_text() == "# Hello"
        assert (project_dir / "frontend" / "index.html").read_text() == "<html></html>"
        assert (project_dir / "backend" / "main.py").read_text() == "print('hi')"

    def test_returns_absolute_path(self, tmp_path):
        result = AppGeneratorAgent._save_project("app", {"a.txt": "x"}, str(tmp_path))
        assert os.path.isabs(result)

    def test_creates_nested_directories(self, tmp_path):
        files = {"deep/nested/dir/file.txt": "content"}
        AppGeneratorAgent._save_project("proj", files, str(tmp_path))
        assert (tmp_path / "proj" / "deep" / "nested" / "dir" / "file.txt").exists()


# ---------------------------------------------------------------------------
# AppGeneratorAgent.generate_app (OpenAI)
# ---------------------------------------------------------------------------

class TestGenerateAppOpenAI:
    @pytest.fixture
    def agent(self):
        with patch("agent._openai_client") as mock_factory:
            mock_client = MagicMock()
            mock_factory.return_value = mock_client
            yield AppGeneratorAgent(api_key="sk-test", provider="openai"), mock_client

    def test_generate_app_creates_expected_files(self, agent, tmp_path):
        instance, mock_client = agent
        responses = [FAKE_README, FAKE_HTML, FAKE_BACKEND, FAKE_REQUIREMENTS]
        mock_client.chat.completions.create.side_effect = [
            _mock_openai_response(r) for r in responses
        ]

        project_path = instance.generate_app("A todo list app", output_dir=str(tmp_path))
        base = Path(project_path)

        assert base.exists()
        assert (base / "README.md").read_text() == FAKE_README
        assert (base / "frontend" / "index.html").read_text() == FAKE_HTML
        assert (base / "backend" / "main.py").read_text() == FAKE_BACKEND
        assert (base / "backend" / "requirements.txt").read_text() == FAKE_REQUIREMENTS

    def test_generate_app_calls_llm_four_times(self, agent, tmp_path):
        instance, mock_client = agent
        mock_client.chat.completions.create.side_effect = [
            _mock_openai_response(r) for r in [FAKE_README, FAKE_HTML, FAKE_BACKEND, FAKE_REQUIREMENTS]
        ]
        instance.generate_app("Blog app", output_dir=str(tmp_path))
        assert mock_client.chat.completions.create.call_count == 4

    def test_empty_idea_raises(self, agent, tmp_path):
        instance, _ = agent
        with pytest.raises(ValueError, match="app_idea must not be empty"):
            instance.generate_app("   ", output_dir=str(tmp_path))


# ---------------------------------------------------------------------------
# AppGeneratorAgent.generate_app (Anthropic)
# ---------------------------------------------------------------------------

class TestGenerateAppAnthropic:
    @pytest.fixture
    def agent(self):
        with patch("agent._anthropic_client") as mock_factory:
            mock_client = MagicMock()
            mock_factory.return_value = mock_client
            yield AppGeneratorAgent(api_key="sk-ant-test", provider="anthropic"), mock_client

    def test_generate_app_creates_expected_files(self, agent, tmp_path):
        instance, mock_client = agent
        mock_client.messages.create.side_effect = [
            _mock_anthropic_response(r) for r in [FAKE_README, FAKE_HTML, FAKE_BACKEND, FAKE_REQUIREMENTS]
        ]

        project_path = instance.generate_app("E-commerce platform", output_dir=str(tmp_path))
        base = Path(project_path)

        assert (base / "README.md").read_text() == FAKE_README
        assert (base / "frontend" / "index.html").read_text() == FAKE_HTML
        assert (base / "backend" / "main.py").read_text() == FAKE_BACKEND

    def test_generate_app_calls_llm_four_times(self, agent, tmp_path):
        instance, mock_client = agent
        mock_client.messages.create.side_effect = [
            _mock_anthropic_response(r) for r in [FAKE_README, FAKE_HTML, FAKE_BACKEND, FAKE_REQUIREMENTS]
        ]
        instance.generate_app("Chat app", output_dir=str(tmp_path))
        assert mock_client.messages.create.call_count == 4
