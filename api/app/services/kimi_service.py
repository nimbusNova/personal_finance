"""Kimi (Moonshot AI) service for PDF extraction — three-stage pipeline.

Stage 1: Document Classification  → identify doc_type, institution, statement_date
Stage 2: Structured Extraction    → extract full data based on doc_type
Stage 3: JSON Repair (fallback)   → fix malformed JSON if Stage 2 fails
"""
import json
import logging
import os
from typing import Optional, Dict, Any

import httpx
from PyPDF2 import PdfReader

from app.config import get_settings
from app.logging_config import get_upload_logger
from app.services.settings_service import get_kimi_api_key

logger = logging.getLogger("api.kimi")

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

CLASSIFICATION_PROMPT = """Analyze this financial document and classify it.

Return ONLY a valid JSON object with these exact fields:
- doc_type: "brokerage" | "bank" | "credit_card" | "unknown"
- institution: string (the financial institution name, e.g. "Charles Schwab", "Chase", "Green Dot Bank")
- statement_date: YYYY-MM-DD (the statement date or period end date)
- account_holder: string (full name of the account holder, or null)
- account_number: string (last 4 digits only, or null)
- confidence: number 0-1 (how confident you are in this classification)

Return only the JSON object, no markdown, no explanation.
"""

BROKERAGE_EXTRACTION_PROMPT = """Extract all holdings and account data from this brokerage statement.

Return ONLY a valid JSON object with these exact fields:
- doc_type: "brokerage"
- institution: string
- account_type: string (e.g. "Individual Taxable", "401k", "IRA", "Roth IRA")
- statement_date: YYYY-MM-DD
- holdings: array of objects, each with:
  - symbol: string (ticker symbol, e.g. "VTI", "AAPL")
  - name: string (full security name)
  - asset_class: string (e.g. "equity", "bond", "commodity", "cash_equivalent", "alternative")
  - sector: string (optional, e.g. "technology", "healthcare")
  - geography: string (optional, e.g. "US", "international", "emerging")
  - quantity: number
  - price: number
  - market_value: number
  - cost_basis: number (optional, null if not shown)
- cash: object with:
  - settled_cash: number
  - unsettled_cash: number (optional, null if not shown)
- total_value: number (total account value including cash + holdings)
- extraction_confidence: number 0-1

Return only the JSON object, no markdown, no explanation.
"""

BANK_EXTRACTION_PROMPT = """Extract all transactions and balances from this bank statement.

Return ONLY a valid JSON object with these exact fields:
- doc_type: "bank"
- institution: string
- account_name: string
- account_type: string (e.g. "Checking", "Savings")
- statement_date: YYYY-MM-DD
- statement_period: object with start_date and end_date (YYYY-MM-DD)
- beginning_balance: number
- ending_balance: number
- transactions: array of objects, each with:
  - date: YYYY-MM-DD
  - description: string
  - amount: number (negative for debit, positive for credit)
  - category: string (inferred: "Income", "Transfer", "Bill Payment", "Withdrawal", "Deposit", "Other")
  - is_recurring: boolean
- extraction_confidence: number 0-1

If there are no transactions, return an empty array [].
Return only the JSON object, no markdown, no explanation.
"""

CREDIT_CARD_EXTRACTION_PROMPT = """Extract all transactions and statement balance from this credit card statement.

Return ONLY a valid JSON object with these exact fields:
- doc_type: "credit_card"
- institution: string (e.g. "Chase", "American Express")
- account_name: string (e.g. "Chase Sapphire Preferred")
- statement_date: YYYY-MM-DD
- statement_balance: number (total balance due)
- transactions: array of objects, each with:
  - date: YYYY-MM-DD
  - merchant: string
  - category: string (inferred: "Food", "Transportation", "Shopping", "Entertainment", "Utilities", "Healthcare", "Travel", "Other")
  - amount: number (positive for charges, negative for payments/credits)
  - is_recurring: boolean (true if subscription/recurring charge)
- extraction_confidence: number 0-1

Return only the JSON object, no markdown, no explanation.
"""

JSON_REPAIR_PROMPT = """The text below was supposed to be valid JSON but failed to parse.
Fix any syntax errors, remove any non-JSON text, and return ONLY valid JSON.
Do not add explanations, markdown, or commentary.

Broken JSON:
"""

# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class KimiService:
    """Service for interacting with Kimi (Moonshot AI) API"""

    def __init__(self):
        settings = get_settings()
        self.api_key = get_kimi_api_key()
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

    def extract_from_pdf(
        self, file_path: str, upload_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Three-stage pipeline:
        1. Get text from PDF (file-upload API or PyPDF2 fallback)
        2. Classify document → get doc_type
        3. Extract structured data → get full JSON
        4. (fallback) Repair JSON if parsing fails
        """
        upload_logger = get_upload_logger(logger, upload_id)

        # --- Step 0: Get extracted text ------------------------------------
        pdf_text, text_source = self._get_pdf_text(file_path, upload_id)
        if not pdf_text:
            return {"success": False, "error": "Could not extract text from PDF", "data": None}

        upload_logger.info(f"PDF text extracted via {text_source}: {len(pdf_text)} chars")

        # --- Stage 1: Classification ---------------------------------------
        upload_logger.info("Stage 1: Document classification")
        classification = self.classify_document(pdf_text, upload_id)
        if not classification.get("success"):
            return {
                "success": False,
                "error": f"Classification failed: {classification.get('error')}",
                "data": None,
            }

        doc_type = classification["data"].get("doc_type", "unknown")
        institution = classification["data"].get("institution", "Unknown")
        statement_date = classification["data"].get("statement_date")
        upload_logger.info(
            f"Classified as doc_type={doc_type}, institution={institution}, "
            f"date={statement_date}, confidence={classification['data'].get('confidence')}"
        )

        # --- Stage 2: Structured extraction --------------------------------
        upload_logger.info("Stage 2: Structured extraction")
        extraction = self.extract_structured_data(pdf_text, doc_type, upload_id)
        if extraction.get("success"):
            # Merge classification metadata if missing
            data = extraction["data"]
            data.setdefault("doc_type", doc_type)
            data.setdefault("institution", institution)
            data.setdefault("statement_date", statement_date)
            data.setdefault("classification", classification["data"])
            upload_logger.info("Stage 2: Extraction succeeded")
            return {"success": True, "data": data}

        upload_logger.warning(f"Stage 2: Extraction failed: {extraction.get('error')}")

        # --- Stage 3: JSON repair fallback ---------------------------------
        raw = extraction.get("raw_response", "")
        if raw:
            upload_logger.info("Stage 3: Attempting JSON repair")
            repair = self.repair_json(raw, upload_id)
            if repair.get("success"):
                data = repair["data"]
                data.setdefault("doc_type", doc_type)
                data.setdefault("institution", institution)
                data.setdefault("statement_date", statement_date)
                data.setdefault("classification", classification["data"])
                upload_logger.info("Stage 3: JSON repair succeeded")
                return {"success": True, "data": data}
            upload_logger.warning(f"Stage 3: JSON repair also failed: {repair.get('error')}")

        return {
            "success": False,
            "error": f"All extraction stages failed. Last error: {extraction.get('error')}",
            "data": None,
        }

    def _get_pdf_text(
        self, file_path: str, upload_id: Optional[int] = None
    ) -> tuple[str, str]:
        """Get text from PDF. Returns (text, source_name).
        Tries file-upload API first, falls back to PyPDF2.
        Deletes the uploaded file from Kimi immediately after use.
        """
        upload_logger = get_upload_logger(logger, upload_id)
        file_id = None

        # Strategy 1: Upload file and get extracted text via API
        try:
            upload_logger.info(f"Uploading file to Kimi: {file_path}")
            file_obj = self._upload_file(file_path)
            file_id = file_obj.get("id")
            if file_id:
                upload_logger.info(f"Retrieving content for file_id={file_id}")
                text = self._get_file_content(file_id)
                if text and len(text) > 50:
                    upload_logger.info(f"File content retrieved: {len(text)} chars")
                    return text, "kimi_file_extract"
                upload_logger.warning(f"File content too short: {len(text)} chars")
        except Exception as exc:
            upload_logger.warning(f"File-upload strategy error: {exc}", exc_info=True)
        finally:
            if file_id:
                self._delete_file(file_id, upload_id)

        # Strategy 2: PyPDF2 fallback
        try:
            upload_logger.info(f"Falling back to PyPDF2 text extraction: {file_path}")
            text = self._extract_pdf_text(file_path)
            if text:
                upload_logger.info(f"PyPDF2 text extracted: {len(text)} chars")
                return text, "pypdf2"
            upload_logger.warning("PyPDF2 returned empty text")
        except Exception as exc:
            upload_logger.warning(f"PyPDF2 extraction error: {exc}", exc_info=True)

        return "", "none"

    def classify_document(
        self, pdf_text: str, upload_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Stage 1: Classify the document type and extract key metadata."""
        upload_logger = get_upload_logger(logger, upload_id)
        payload = self._build_payload(CLASSIFICATION_PROMPT, pdf_text)
        result = self._call_chat_completion(payload, upload_id)

        if not result.get("success"):
            return result

        try:
            data = result["data"]
            doc_type = data.get("doc_type", "unknown")
            if doc_type not in ("brokerage", "bank", "credit_card", "unknown"):
                doc_type = "unknown"
            return {
                "success": True,
                "data": {
                    "doc_type": doc_type,
                    "institution": data.get("institution", "Unknown"),
                    "statement_date": data.get("statement_date"),
                    "account_holder": data.get("account_holder"),
                    "account_number": data.get("account_number"),
                    "confidence": data.get("confidence", 0.5),
                },
            }
        except Exception as exc:
            upload_logger.error(f"Classification result parsing failed: {exc}")
            return {"success": False, "error": str(exc), "data": None}

    def extract_structured_data(
        self, pdf_text: str, doc_type: str, upload_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Stage 2: Extract full structured data based on document type."""
        prompt = self._select_extraction_prompt(doc_type)
        payload = self._build_payload(prompt, pdf_text)
        return self._call_chat_completion(payload, upload_id)

    def repair_json(
        self, raw_text: str, upload_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Stage 3: Ask Kimi to fix malformed JSON."""
        upload_logger = get_upload_logger(logger, upload_id)
        prompt = JSON_REPAIR_PROMPT + raw_text[:15000]
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a JSON repair assistant."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 4000,
        }
        upload_logger.debug(f"JSON repair prompt length: {len(prompt)} chars")
        return self._call_chat_completion(payload, upload_id)

    # -----------------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------------

    def _select_extraction_prompt(self, doc_type: str) -> str:
        if doc_type == "brokerage":
            return BROKERAGE_EXTRACTION_PROMPT
        if doc_type == "credit_card":
            return CREDIT_CARD_EXTRACTION_PROMPT
        if doc_type == "bank":
            return BANK_EXTRACTION_PROMPT
        # Fallback to bank prompt for unknown (most permissive)
        return BANK_EXTRACTION_PROMPT

    def _build_payload(self, system_prompt: str, pdf_text: str) -> Dict[str, Any]:
        """Build a chat completion payload with the prompt + PDF text."""
        max_chars = 30000
        if len(pdf_text) > max_chars:
            pdf_text = pdf_text[:max_chars] + "\n...[truncated]"

        return {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        f"Below is the extracted text from a financial statement PDF.\n\n"
                        f"--- PDF TEXT START ---\n{pdf_text}\n--- PDF TEXT END ---"
                    ),
                },
            ],
            "max_tokens": 4000,
        }

    def _upload_file(self, file_path: str) -> Dict[str, Any]:
        """Upload PDF to Kimi and get file object"""
        filename = os.path.basename(file_path)
        with open(file_path, "rb") as f:
            pdf_content = f.read()

        files = {"file": (filename, pdf_content, "application/pdf")}
        response = self.client.post("/files", data={"purpose": "file-extract"}, files=files)
        response.raise_for_status()
        return response.json()

    def _get_file_content(self, file_id: str) -> str:
        """Retrieve extracted text content from an uploaded file."""
        response = self.client.get(f"/files/{file_id}/content")
        response.raise_for_status()
        return response.text

    def _delete_file(self, file_id: str, upload_id: Optional[int] = None) -> None:
        """Delete an uploaded file from Kimi. Never raises — logs on failure."""
        upload_logger = get_upload_logger(logger, upload_id)
        try:
            response = self.client.delete(f"/files/{file_id}")
            response.raise_for_status()
            upload_logger.info(f"Deleted file from Kimi: file_id={file_id}")
        except Exception as exc:
            upload_logger.warning(f"Failed to delete file from Kimi: file_id={file_id}: {exc}")

    def _extract_pdf_text(self, file_path: str) -> str:
        """Extract raw text from a PDF using PyPDF2"""
        reader = PdfReader(file_path)
        text_parts = []
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        return "\n".join(text_parts)

    def _call_chat_completion(
        self, payload: Dict[str, Any], upload_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Call the chat completions endpoint and parse the response."""
        upload_logger = get_upload_logger(logger, upload_id)
        try:
            response = self.client.post("/chat/completions", json=payload)
            upload_logger.debug(f"Chat completion status: {response.status_code}")
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            upload_logger.error(
                f"Chat completion HTTP error: {exc.response.status_code} "
                f"for URL {exc.request.url}"
            )
            try:
                err_body = exc.response.json()
                upload_logger.error(
                    f"Error response body: {json.dumps(err_body, default=str)[:1000]}"
                )
            except Exception:
                upload_logger.error(
                    f"Error response text: {exc.response.text[:1000]}"
                )
            return {
                "success": False,
                "error": f"HTTP {exc.response.status_code}: {exc.response.text[:500]}",
            }
        except Exception as exc:
            upload_logger.error(f"Chat completion request failed: {exc}", exc_info=True)
            return {"success": False, "error": str(exc)}

        try:
            result = response.json()
        except json.JSONDecodeError as exc:
            upload_logger.error(f"Failed to decode JSON response: {exc}")
            return {"success": False, "error": f"Invalid JSON response: {exc}"}

        try:
            content = result["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            upload_logger.error(
                f"Unexpected response structure: {json.dumps(result, default=str)[:1000]}"
            )
            return {"success": False, "error": f"Unexpected response structure: {exc}"}

        # Parse JSON from content
        upload_logger.debug(f"Raw content before JSON parse: {repr(content[:500])}")
        try:
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            stripped = content.strip()
            if not stripped:
                upload_logger.error("Response content is empty after stripping markdown")
                return {
                    "success": False,
                    "error": "Empty response content",
                    "raw_response": content,
                    "data": None,
                }

            extracted_data = json.loads(stripped)

            return {
                "success": True,
                "data": extracted_data,
                "raw_response": content,
                "confidence": extracted_data.get("extraction_confidence", 0.5),
                "model": result.get("model", "unknown"),
                "usage": result.get("usage", {}),
            }
        except json.JSONDecodeError as exc:
            upload_logger.error(f"Failed to parse JSON from response: {exc}")
            upload_logger.debug(f"Content that failed to parse: {repr(content[:2000])}")
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
