# Agente-IA — AI App Generator

An AI-powered Python agent that turns a plain-language app idea into a ready-to-use
project scaffold, complete with architecture documentation, an HTML/Tailwind frontend,
and a FastAPI backend.

---

## Features

- **Single command** to go from idea → full project skeleton.
- **Two LLM providers** supported out of the box: OpenAI (default) and Anthropic.
- Generates:
  - `README.md` — architecture, folder tree, API overview, setup instructions.
  - `frontend/index.html` — responsive page using Tailwind CSS CDN.
  - `backend/main.py` — FastAPI application with CORS and Pydantic models.
  - `backend/requirements.txt` — pinned Python dependencies for the generated backend.
- Each project is saved in its **own uniquely named folder**.

---

## Requirements

- Python 3.9 or higher
- An [OpenAI](https://platform.openai.com/api-keys) **or** [Anthropic](https://console.anthropic.com/) API key

---

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/robinsonlabbe123-dotcom/Agente-IA.git
cd Agente-IA

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure your API key
cp .env.example .env
# Edit .env and add your key
```

---

## Usage

### CLI

```bash
# OpenAI (default)
export OPENAI_API_KEY=sk-...
python main.py "A task management app with user authentication"

# Anthropic
export ANTHROPIC_API_KEY=sk-ant-...
python main.py "E-commerce platform" --provider anthropic

# Custom output directory
python main.py "Blog platform with markdown support" --output ./my-projects
```

### Python API

```python
from agent import AppGeneratorAgent

agent = AppGeneratorAgent(api_key="sk-...", provider="openai")
project_path = agent.generate_app(
    app_idea="A task management app with user authentication",
    output_dir="./projects",
)
print(f"Project created at: {project_path}")
```

---

## Generated Project Structure

```
<project-slug>/
├── README.md               ← Architecture & setup guide
├── frontend/
│   └── index.html          ← HTML + Tailwind CSS page
└── backend/
    ├── main.py             ← FastAPI application
    └── requirements.txt    ← Backend Python dependencies
```

---

## Repository Structure

```
Agente-IA/
├── agent.py           ← AppGeneratorAgent class
├── main.py            ← CLI entry point
├── requirements.txt   ← Agent dependencies
├── .env.example       ← Environment variable template
└── README.md
```

