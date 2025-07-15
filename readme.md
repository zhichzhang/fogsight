# Fogsight Agent



## 🚀 Getting Started

### 1. Installation

Make sure you have installed:
- [Python 3.10+](https://www.python.org/downloads/)

Create and activate your Python environment:

```bash
pip install -r requirements.txt
```

---

### 2. Credentials Setup

* Rename `demo-credentials.json` to `credentials.json`
* Replace the values for:

```json
{
  "OPENAI_API_KEY": "your-key",
  "BASE_URL": "https://api.openai.com/v1"
}
```

---

### 3. Run the Service

```bash
uvicorn main:app --host 127.0.0.1 --reload
```

Visit: [http://127.0.0.1:8000](http://127.0.0.1:8000)
