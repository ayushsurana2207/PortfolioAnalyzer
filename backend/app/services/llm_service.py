import abc
import base64
import io
import json
import logging
from typing import Optional

from app.config import get_settings

logger = logging.getLogger("llm_service")


def clean_json_string(raw_text: str) -> str:
    """Strips markdown code blocks and whitespace from LLM output to ensure valid JSON parsing."""
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        first_newline = cleaned.find("\n")
        if first_newline != -1:
            cleaned = cleaned[first_newline:].strip()
        else:
            cleaned = cleaned[3:].strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()
    return cleaned


class LLMService(abc.ABC):
    """Abstract base class establishing a unified interface for all LLM interactions."""

    @abc.abstractmethod
    async def parse_pdf(self, file_bytes: bytes, prompt: str) -> dict:
        """Parses investment PDF statements and returns structured JSON data."""
        pass

    @abc.abstractmethod
    async def generate_json(self, prompt: str, system_prompt: str) -> dict:
        """Generates a structured JSON response for general reasoning prompts (e.g., monthly reviews)."""
        pass


class GeminiLLMService(LLMService):
    """Google Gemini API implementation using the official google-generativeai SDK."""

    def __init__(self, api_key: str):
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self.model_name = "gemini-1.5-pro"
        logger.info(f"Initialized single active LLM: GeminiLLMService ({self.model_name})")

    async def parse_pdf(self, file_bytes: bytes, prompt: str) -> dict:
        import google.generativeai as genai
        model = genai.GenerativeModel(self.model_name)
        
        pdf_part = {
            "mime_type": "application/pdf",
            "data": file_bytes
        }
        
        generation_config = {
            "response_mime_type": "application/json"
        }
        
        response = await model.generate_content_async(
            contents=[pdf_part, prompt],
            generation_config=generation_config
        )
        
        cleaned_text = clean_json_string(response.text)
        return json.loads(cleaned_text)

    async def generate_json(self, prompt: str, system_prompt: str) -> dict:
        import google.generativeai as genai
        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_prompt
        )
        
        generation_config = {
            "response_mime_type": "application/json"
        }
        
        response = await model.generate_content_async(
            contents=prompt,
            generation_config=generation_config
        )
        
        cleaned_text = clean_json_string(response.text)
        return json.loads(cleaned_text)


class AnthropicLLMService(LLMService):
    """Anthropic Claude API implementation using the official anthropic SDK."""

    def __init__(self, api_key: str):
        import anthropic
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model_name = "claude-3-5-sonnet-20241022"
        logger.info(f"Initialized single active LLM: AnthropicLLMService ({self.model_name})")

    async def parse_pdf(self, file_bytes: bytes, prompt: str) -> dict:
        response = await self.client.messages.create(
            model=self.model_name,
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": base64.b64encode(file_bytes).decode()
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }]
        )
        
        raw_text = response.content[0].text
        cleaned_text = clean_json_string(raw_text)
        return json.loads(cleaned_text)

    async def generate_json(self, prompt: str, system_prompt: str) -> dict:
        response = await self.client.messages.create(
            model=self.model_name,
            max_tokens=8192,
            system=system_prompt,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )
        
        raw_text = response.content[0].text
        cleaned_text = clean_json_string(raw_text)
        return json.loads(cleaned_text)


class OpenAILLMService(LLMService):
    """OpenAI API implementation using the official openai SDK."""

    def __init__(self, api_key: str):
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(api_key=api_key)
        self.model_name = "gpt-4o"
        logger.info(f"Initialized single active LLM: OpenAILLMService ({self.model_name})")

    async def parse_pdf(self, file_bytes: bytes, prompt: str) -> dict:
        import pypdf
        
        logger.info("Extracting text from PDF locally (OpenAI fallback)...")
        pdf_file = io.BytesIO(file_bytes)
        reader = pypdf.PdfReader(pdf_file)
        text_content = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_content.append(text)
        
        extracted_text = "\n--- PAGE BREAK ---\n".join(text_content)
        
        full_prompt = (
            f"Here is the text extracted from the portfolio statement:\n\n"
            f"=== START STATEMENT TEXT ===\n"
            f"{extracted_text}\n"
            f"=== END STATEMENT TEXT ===\n\n"
            f"Based on the text above, execute the following request:\n"
            f"{prompt}"
        )
        
        response = await self.client.chat.completions.create(
            model=self.model_name,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are a precise data extraction agent. Return only a structured JSON object."},
                {"role": "user", "content": full_prompt}
            ],
            max_tokens=4096
        )
        
        raw_text = response.choices[0].message.content
        cleaned_text = clean_json_string(raw_text)
        return json.loads(cleaned_text)

    async def generate_json(self, prompt: str, system_prompt: str) -> dict:
        response = await self.client.chat.completions.create(
            model=self.model_name,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            max_tokens=4096
        )
        
        raw_text = response.choices[0].message.content
        cleaned_text = clean_json_string(raw_text)
        return json.loads(cleaned_text)


def get_llm_service() -> LLMService:
    """Factory function that returns the single configured LLMService provider.
    
    Checks database AppSettings first for dynamic configurations, falling back to 
    environment variables. Only instantiates the selected provider and its key.
    """
    settings = get_settings()
    
    # Baseline from environment variables
    provider = settings.LLM_PROVIDER
    gemini_key = settings.GEMINI_API_KEY
    openai_key = settings.OPENAI_API_KEY
    anthropic_key = settings.ANTHROPIC_API_KEY
    
    # Query database AppSetting table for dynamic overrides
    from app.database import SessionLocal
    from app.models.settings import AppSetting
    from sqlmodel import select
    
    try:
        with SessionLocal() as session:
            db_settings = session.exec(select(AppSetting)).all()
            db_map = {s.key: s.value for s in db_settings}
            
            if "llm_provider" in db_map and db_map["llm_provider"]:
                provider = db_map["llm_provider"]
            if "gemini_api_key" in db_map and db_map["gemini_api_key"]:
                gemini_key = db_map["gemini_api_key"]
            if "openai_api_key" in db_map and db_map["openai_api_key"]:
                openai_key = db_map["openai_api_key"]
            if "anthropic_api_key" in db_map and db_map["anthropic_api_key"]:
                anthropic_key = db_map["anthropic_api_key"]
    except Exception as e:
        logger.error(f"Failed to query dynamic LLM configs from database: {e}")
        
    provider = provider.strip().lower()
    
    # Instantiate ONLY the single selected model
    if provider == "gemini":
        if not gemini_key:
            raise ValueError(
                "LLM provider is set to 'gemini' but GEMINI_API_KEY is not configured. "
                "Please set it in your .env or on the Settings page."
            )
        return GeminiLLMService(api_key=gemini_key)
        
    elif provider == "anthropic" or provider == "claude":
        if not anthropic_key:
            raise ValueError(
                "LLM provider is set to 'anthropic' but ANTHROPIC_API_KEY is not configured. "
                "Please set it in your .env or on the Settings page."
            )
        return AnthropicLLMService(api_key=anthropic_key)
        
    elif provider == "openai":
        if not openai_key:
            raise ValueError(
                "LLM provider is set to 'openai' but OPENAI_API_KEY is not configured. "
                "Please set it in your .env or on the Settings page."
            )
        return OpenAILLMService(api_key=openai_key)
        
    else:
        raise ValueError(
            f"Unsupported LLM provider '{provider}' selected. "
            "Supported values are: 'gemini', 'anthropic', 'openai'."
        )
