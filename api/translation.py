import os
from pathlib import Path
from dotenv import load_dotenv
import google.generativeai as genai

# Cargar .env del proyecto
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

# 1. No necesitamos importar asyncio

def translate_text(text, target_language, source_language=None):
    """
    Traduce un texto usando Gemini.
    """
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {'error': 'GEMINI_API_KEY no esta configurada.'}

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash')
        if source_language:
            prompt = (
                f"Translate the following text to {target_language}. "
                f"Source language: {source_language}. "
                "Respond with only the translated text."
            )
        else:
            prompt = (
                f"Translate the following text to {target_language}. "
                "Respond with only the translated text."
            )

        response = model.generate_content(f"{prompt}\n\n{text}")
        translated_text = getattr(response, 'text', None)
        if not translated_text:
            return {'error': 'Gemini devolvio una respuesta vacia.'}

        return {
            'translated_text': translated_text.strip(),
            'detected_source_language': source_language or 'unknown'
        }
    except Exception as e:
        return {'error': f"Gemini error: {str(e)}"}
