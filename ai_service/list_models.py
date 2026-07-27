import urllib.request
import json
import os
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("GEMINI_API_KEY")
url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"

req = urllib.request.Request(url)

try:
    with urllib.request.urlopen(req) as response:
        res_body = response.read().decode("utf-8")
        models = json.loads(res_body)
        print("AVAILABLE MODELS:")
        for m in models.get("models", []):
            if "generateContent" in m.get("supportedGenerationMethods", []):
                print(" -", m.get("name"))
except Exception as e:
    print("ERROR:", str(e))
    if hasattr(e, "read"):
        print(e.read().decode("utf-8"))
