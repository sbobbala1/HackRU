"""Gemini REST adapter for the app's existing structured-response interface."""
import json
import os
import re
from types import SimpleNamespace
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

class GeminiClient:
    def __init__(self, key, timeout=45):
        self.key = key
        self.timeout = timeout

    def with_options(self, timeout=45, max_retries=0):
        return GeminiClient(self.key, timeout)

    @property
    def responses(self):
        return self

    def create(self, *, input, text, **ignored):
        model = os.getenv('GEMINI_MODEL', 'gemini-3.5-flash-lite')
        if not re.fullmatch(r'[a-zA-Z0-9._-]+', model):
            raise RuntimeError('GEMINI_MODEL is invalid. Use a Gemini model name.')
        system = '\n'.join(m['content'] for m in input if m['role']=='system')
        contents = [{'role':'user' if m['role']=='user' else 'model', 'parts':[{'text':m['content']}]} for m in input if m['role']!='system']
        payload = {'systemInstruction':{'parts':[{'text':system}]},'contents':contents,
                   'generationConfig':{'responseMimeType':'application/json','responseJsonSchema':text['format']['schema']}}
        request = Request(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                          data=json.dumps(payload).encode(), headers={'Content-Type':'application/json','x-goog-api-key':self.key},method='POST')
        try:
            with urlopen(request,timeout=self.timeout) as response:
                result=json.load(response)
        except HTTPError as exc:
            messages={400:'Gemini rejected the request. Check your API key and GEMINI_MODEL setting.',
                      401:'Gemini rejected the API key. Replace GEMINI_API_KEY and restart the backend.',
                      403:'Gemini access denied. Check the API key permissions and Google AI Studio project.',
                      404:'Gemini model is unavailable. Check GEMINI_MODEL in backend/.env.',
                      429:'Gemini quota or rate limit reached. Check Google AI Studio usage and billing, then retry.'}
            raise RuntimeError(messages.get(exc.code,'Gemini is temporarily unavailable. Please retry.')) from None
        except (TimeoutError, URLError):
            raise RuntimeError('Cannot reach Gemini or the request timed out. Check connectivity and retry.') from None
        candidates=result.get('candidates') or []
        if not candidates or candidates[0].get('finishReason') not in (None,'STOP'):
            raise RuntimeError('Gemini could not complete this answer. Try rephrasing your question.')
        output=''.join(p.get('text','') for p in candidates[0].get('content',{}).get('parts',[]) if not p.get('thought'))
        if not output.strip():
            raise RuntimeError('Gemini returned no answer. Please retry.')
        return SimpleNamespace(output_text=output)
