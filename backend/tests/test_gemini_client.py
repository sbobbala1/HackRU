import io
import json
import os
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from app.gemini_client import GeminiClient
from app.llm_assist import _client


class GeminiTests(unittest.TestCase):
    def call(self):
        return GeminiClient('test-secret').responses.create(
            input=[{'role': 'system', 'content': 'Use sources.'}, {'role': 'user', 'content': 'Explain.'}],
            text={'format': {'schema': {'type': 'object'}}})

    def response(self, candidate):
        return io.BytesIO(json.dumps({'candidates': [candidate]}).encode())

    def test_structured_request_keeps_key_out_of_url(self):
        with patch('app.gemini_client.urlopen', return_value=self.response({
                'finishReason': 'STOP', 'content': {'parts': [
                    {'text': 'internal', 'thought': True}, {'text': '{"status":"supported"}'}]}})) as send:
            result = self.call()
        request = send.call_args.args[0]
        self.assertNotIn('test-secret', request.full_url)
        self.assertEqual(request.get_header('X-goog-api-key'), 'test-secret')
        body = json.loads(request.data)
        self.assertEqual(body['generationConfig']['responseJsonSchema'], {'type': 'object'})
        self.assertEqual(body['contents'][0]['parts'][0]['text'], 'Explain.')
        self.assertEqual(result.output_text, '{"status":"supported"}')

    def test_quota_error_is_actionable_and_sanitized(self):
        error = HTTPError('https://example.com', 429, 'test-secret', {}, None)
        with patch('app.gemini_client.urlopen', side_effect=error):
            with self.assertRaisesRegex(RuntimeError, 'quota or rate limit') as caught:
                self.call()
        self.assertNotIn('test-secret', str(caught.exception))

    def test_incomplete_or_empty_output_rejected(self):
        for candidate in [{'finishReason': 'MAX_TOKENS'}, {'finishReason': 'SAFETY'},
                          {'finishReason': 'STOP', 'content': {'parts': []}}]:
            with self.subTest(candidate=candidate), patch('app.gemini_client.urlopen', return_value=self.response(candidate)):
                with self.assertRaises(RuntimeError):
                    self.call()

    def test_gemini_preferred_and_missing_configuration(self):
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test', 'OPENAI_API_KEY': 'other'}, clear=True):
            self.assertIsInstance(_client(), GeminiClient)
        with patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(_client())
