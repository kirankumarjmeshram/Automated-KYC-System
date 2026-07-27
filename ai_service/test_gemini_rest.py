import urllib.request
import json
import os
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("GEMINI_API_KEY")
print(f"API KEY: {key[:10]}...")

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key={key}"
payload = {
    "contents": [
        {
            "parts": [
                {"text": "Hello, return raw JSON: {\"status\": \"ok\"}"}
            ]
        }
    ]
}

req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})

try:
    with urllib.request.urlopen(req) as response:
        res_body = response.read().decode("utf-8")
        print("GEMINI REST API SUCCESS:")
        print(res_body)
except Exception as e:
    print("GEMINI REST API ERROR:", str(e))
    if hasattr(e, "read"):
        print(e.read().decode("utf-8"))
