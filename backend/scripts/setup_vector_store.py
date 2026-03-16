"""Run once to create the OpenAI Vector Store.
Copy the printed ID into backend/.env as OPENAI_VECTOR_STORE_ID.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from openai import OpenAI
from app.config import settings

client = OpenAI(api_key=settings.openai_api_key)
vs = client.vector_stores.create(name="agentic-rag-module1")
print(f"OPENAI_VECTOR_STORE_ID={vs.id}")
