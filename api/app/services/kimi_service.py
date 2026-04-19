"""Kimi (Moonshot AI) service for PDF extraction"""
import json
import logging
import os
from typing import Optional, Dict, Any

import httpx
from PyPDF2 import PdfReader

from app.config import get_settings

logger = logging.getLogger("api.kimi")

# Kimi extraction prompts
BROKERAGE_PROMPT = """
Analyze this brokerage statement PDF and extract the following information as structured JSON:

Required fields:
- doc_type: "brokerage"
- institution: string (e.g., "Charles Schwab", "Fidelity")
- account_type: string (e.g., "Individual Taxable", "401k", "IRA", "Roth IRA")
- statement_date: YYYY-MM-DD format
- holdings: array of objects with:
  - symbol: string (ticker symbol)
  - name: string (full security name)
  - quantity: number (shares/units)
  - price: number (current price per share)
  - market_value: number (total value)
  - cost_basis: number (optional, if shown)
- cash: object with:
  - settled_cash: number
  - unsettled_cash: number (if shown)
- total_value: number (total account value)
- extraction_confidence: number between 0 and 1

Guidelines:
- Be precise with numbers
- Use null for missing optional fields
- If uncertain about a value, use null and lower confidence
- Include all holdings listed on the statement
- Calculate extraction_confidence based on clarity of data

Return only valid JSON, no markdown formatting.
"""

CREDIT_CARD_PROMPT = """
Analyze this credit card statement PDF and extract the following information as structured JSON:

Required fields:
- doc_type: "credit_card"
- institution: string (e.g., "Chase", "American Express")
- account_name: string (e.g., "Chase Sapphire Preferred")
- statement_date: YYYY-MM-DD format
- statement_balance: number (total balance)
- transactions: array of objects with:
  - date: YYYY-MM-DD format
  - merchant: string (merchant name)
  - category: string (inferred category: "Food", "Transportation", "Shopping", "Entertainment", "Utilities", "Healthcare", "Travel", "Other")
  - amount: number (positive for charges, negative for payments/credits)
  - is_recurring: boolean (true if appears to be a subscription/recurring charge)
- extraction_confidence: number between 0 and 1

Guidelines:
- Infer category from merchant name when not explicitly stated
- Mark as recurring: streaming services, subscriptions, utilities
- Use null for missing optional fields
- Include ALL transactions from the statement
- Calculate extraction_confidence based on clarity of data

Return only valid JSON, no markdown formatting.
"""

BANK_PROMPT = """
Analyze this bank statement PDF and extract the following information as structured JSON:

Required fields:
- doc_type: "bank"
- institution: string (e.g., "Bank of America", "Chase")
- account_name: string
- account_type: string (e.g., "Checking", "Savings")
- statement_date: YYYY-MM-DD format
- statement_period: object with start_date and end_date
- beginning_balance: number
- ending_balance: number
- transactions: array of objects with:
  - date: YYYY-MM-DD format
  - description: string
  - amount: number (negative for debit, positive for credit)
  - category: string (inferred: "Income", "Transfer", "Bill Payment", "Withdrawal", "Deposit", "Other")
  - is_recurring: boolean
- extraction_confidence: number between 0 and 1

Guidelines:
- Infer category from description
- Use null for missing optional fields
- Include ALL transactions
- Calculate extraction_confidence based on clarity

Return only valid JSON, no markdown formatting.
"""


class KimiService:
    """Service for interacting with Kimi (Moonshot AI) API"""

    def __init__(self):
        settings = get_settings()
        self.api_key = settings.kimi_api_key
        self.base_url = settings.kimi_base_url
        self.model = settings.kimi_model
        logger.info(
            f"KimiService initialized: base_url={self.base_url}, "
            f"model={self.model}, key_set={'yes' if self.api_key else 'no'}"
        )
        self.client = httpx.Client(
            base_url=self.base_url,
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=120.0,
        )

    def extract_from_pdf(self, file_path: str, doc_type_hint: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract structured data from a PDF using Kimi.
        Tries file-upload + file_url reference first, then falls back to text extraction.
        """
        if not doc_type_hint:
            doc_type_hint = self._detect_doc_type(file_path)

        system_prompt = self._select_prompt(doc_type_hint)

        # Strategy 1: Upload file and reference by URL (Kimi-native)
        try:
            logger.info(f"Trying file-upload strategy for {file_path}")
            file_obj = self._upload_file(file_path)
            logger.info(f"File upload response: {json.dumps(file_obj, default=str)[:500]}")

            result = self._extract_with_file_url(file_obj, system_prompt)
            if result.get("success"):
                logger.info("File-upload strategy succeeded")
                return result
            logger.warning(f"File-upload strategy failed: {result.get('error')}")
        except Exception as exc:
            logger.warning(f"File-upload strategy error: {exc}", exc_info=True)

        # Strategy 2: Extract text from PDF and send as text message
        try:
            logger.info(f"Falling back to text-extraction strategy for {file_path}")
            pdf_text = self._extract_pdf_text(file_path)
            if pdf_text:
                result = self._extract_with_text(pdf_text, system_prompt)
                if result.get("success"):
                    logger.info("Text-extraction strategy succeeded")
                    return result
                logger.warning(f"Text-extraction strategy failed: {result.get('error')}")
            else:
                logger.warning("No text could be extracted from PDF")
        except Exception as exc:
            logger.warning(f"Text-extraction strategy error: {exc}", exc_info=True)

        return {
            "success": False,
            "error": "All extraction strategies failed. Check logs for details.",
            "data": None,
        }

    def _select_prompt(self, doc_type_hint: str) -> str:
        if doc_type_hint == "brokerage":
            return BROKERAGE_PROMPT
        elif doc_type_hint == "credit_card":
            return CREDIT_CARD_PROMPT
        elif doc_type_hint == "bank":
            return BANK_PROMPT
        return self._get_generic_prompt()

    def _detect_doc_type(self, file_path: str) -> str:
        """Auto-detect document type from filename keywords"""
        name = os.path.basename(file_path).lower()
        if any(k in name for k in ("brokerage", "schwab", "fidelity", "vanguard", "td", "e*trade")):
            return "brokerage"
        if any(k in name for k in ("credit", "card", "chase", "amex", "visa", "mastercard")):
            return "credit_card"
        if any(k in name for k in ("bank", "checking", "savings", "deposit")):
            return "bank"
        return "unknown"

    def _get_generic_prompt(self) -> str:
        return """
Analyze this financial statement PDF and extract the following:

1. First, identify the document type: brokerage statement, credit card statement, or bank statement
2. Then extract all relevant financial data

For brokerage: holdings, cash, account value
For credit card: transactions, balance, due date
For bank: transactions, balances, deposits/withdrawals

Return structured JSON with:
- doc_type: "brokerage" | "credit_card" | "bank"
- institution: string
- statement_date: YYYY-MM-DD
- extraction_confidence: 0-1
- And all relevant data fields

Return only valid JSON.
"""

    def _upload_file(self, file_path: str) -> Dict[str, Any]:
        """Upload PDF to Kimi and get file object"""
        filename = os.path.basename(file_path)
        with open(file_path, 'rb') as f:
            pdf_content = f.read()

        files = {'file': (filename, pdf_content, 'application/pdf')}
        response = self.client.post("/files", data={"purpose": "file-extract"}, files=files)
        response.raise_for_status()
        return response.json()

    def _get_file_content(self, file_id: str) -> str:
        """Retrieve extracted text content from an uploaded file."""
        response = self.client.get(f"/files/{file_id}/content")
        response.raise_for_status()
        return response.text

    def _extract_with_file_url(self, file_obj: Dict[str, Any], system_prompt: str) -> Dict[str, Any]:
        """Extract using Kimi chat completion with uploaded file content.

        Moonshot API flow:
        1. Upload file -> get file_id
        2. GET /files/{file_id}/content -> extracted text
        3. Send text as system message + user prompt to chat completion
        """
        if isinstance(file_obj, str):
            logger.warning(f"File upload returned string instead of dict: {file_obj[:200]}")
            return {"success": False, "error": "Unexpected file upload response format"}

        file_id = file_obj.get("id")
        if not file_id:
            logger.warning(f"No file id in upload response: {json.dumps(file_obj, default=str)[:500]}")
            return {"success": False, "error": "No file id in upload response"}

        logger.info(f"Retrieving extracted content for file {file_id}")
        try:
            file_content = self._get_file_content(file_id)
        except Exception as exc:
            logger.warning(f"Failed to retrieve file content: {exc}")
            return {"success": False, "error": f"Failed to retrieve file content: {exc}"}

        if not file_content or len(file_content) < 50:
            logger.warning(f"File content too short ({len(file_content)} chars), treating as failure")
            return {"success": False, "error": "File content too short"}

        logger.info(f"File content retrieved: {len(file_content)} chars")

        # Truncate if too long (most APIs have context limits)
        max_chars = 30000
        if len(file_content) > max_chars:
            file_content = file_content[:max_chars] + "\n...[truncated]"

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "system", "content": file_content},
                {
                    "role": "user",
                    "content": "Extract all financial data from this statement and return as JSON.",
                },
            ],
            "max_tokens": 4000,
        }
        logger.debug(f"Chat completion payload (file content): model={self.model}, content_len={len(file_content)}")
        return self._call_chat_completion(payload)

    def _extract_pdf_text(self, file_path: str) -> str:
        """Extract raw text from a PDF using PyPDF2"""
        reader = PdfReader(file_path)
        text_parts = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        return "\n".join(text_parts)

    def _extract_with_text(self, pdf_text: str, system_prompt: str) -> Dict[str, Any]:
        """Extract using Kimi chat completion with inline text"""
        # Truncate if too long (most APIs have context limits)
        max_chars = 30000
        if len(pdf_text) > max_chars:
            pdf_text = pdf_text[:max_chars] + "\n...[truncated]"

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        f"Below is the text content of a financial statement PDF. "
                        f"Extract all financial data and return as JSON.\n\n"
                        f"--- PDF TEXT START ---\n{pdf_text}\n--- PDF TEXT END ---"
                    ),
                },
            ],
            "max_tokens": 4000,
        }
        logger.debug(f"Chat completion payload (text): model={self.model}, text_len={len(pdf_text)}")
        return self._call_chat_completion(payload)

    def _call_chat_completion(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Call the chat completions endpoint and parse the response"""
        try:
            response = self.client.post("/chat/completions", json=payload)
            logger.debug(f"Chat completion status: {response.status_code}")
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error(
                f"Chat completion HTTP error: {exc.response.status_code} "
                f"for URL {exc.request.url}"
            )
            try:
                err_body = exc.response.json()
                logger.error(f"Error response body: {json.dumps(err_body, default=str)[:1000]}")
            except Exception:
                logger.error(f"Error response text: {exc.response.text[:1000]}")
            return {
                "success": False,
                "error": f"HTTP {exc.response.status_code}: {exc.response.text[:500]}",
            }
        except Exception as exc:
            logger.error(f"Chat completion request failed: {exc}", exc_info=True)
            return {"success": False, "error": str(exc)}

        try:
            result = response.json()
        except json.JSONDecodeError as exc:
            logger.error(f"Failed to decode JSON response: {exc}")
            return {"success": False, "error": f"Invalid JSON response: {exc}"}

        try:
            content = result["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            logger.error(f"Unexpected response structure: {json.dumps(result, default=str)[:1000]}")
            return {"success": False, "error": f"Unexpected response structure: {exc}"}

        # Parse JSON from content
        try:
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            extracted_data = json.loads(content.strip())

            return {
                "success": True,
                "data": extracted_data,
                "raw_response": content,
                "confidence": extracted_data.get("extraction_confidence", 0.5),
                "model": result.get("model", "unknown"),
                "usage": result.get("usage", {}),
            }
        except json.JSONDecodeError as exc:
            logger.error(f"Failed to parse JSON from response: {exc}")
            return {
                "success": False,
                "error": f"Failed to parse JSON: {exc}",
                "raw_response": content,
                "data": None,
            }

    def close(self):
        """Close HTTP client"""
        self.client.close()


# Singleton instance
_kimi_service: Optional[KimiService] = None


def get_kimi_service() -> KimiService:
    """Get or create Kimi service singleton"""
    global _kimi_service
    if _kimi_service is None:
        _kimi_service = KimiService()
    return _kimi_service
