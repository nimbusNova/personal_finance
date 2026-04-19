"""Kimi (Moonshot AI) service for PDF extraction"""
import json
import time
from typing import Optional, Dict, Any
import httpx
from app.config import get_settings

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
        self.client = httpx.Client(
            base_url=self.base_url,
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=60.0  # Kimi can take time for large PDFs
        )
    
    def extract_from_pdf(self, file_path: str, doc_type_hint: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract structured data from a PDF using Kimi
        
        Args:
            file_path: Path to PDF file
            doc_type_hint: Optional hint ("brokerage", "credit_card", "bank")
        
        Returns:
            Dict with extracted data and metadata
        """
        # First, detect document type if not provided
        if not doc_type_hint:
            doc_type_hint = self._detect_doc_type(file_path)
        
        # Select appropriate prompt
        if doc_type_hint == "brokerage":
            system_prompt = BROKERAGE_PROMPT
        elif doc_type_hint == "credit_card":
            system_prompt = CREDIT_CARD_PROMPT
        elif doc_type_hint == "bank":
            system_prompt = BANK_PROMPT
        else:
            system_prompt = self._get_generic_prompt()
        
        # Read PDF file
        with open(file_path, 'rb') as f:
            pdf_content = f.read()
        
        # Upload file to Kimi
        file_obj = self._upload_file(pdf_content, file_path)
        
        # Extract using Kimi
        return self._extract_with_kimi(file_obj, system_prompt)
    
    def _detect_doc_type(self, file_path: str) -> str:
        """Auto-detect document type from first few pages"""
        # For now, use a generic detection prompt
        # In production, you might scan for keywords like "brokerage", "credit card", etc.
        return "unknown"
    
    def _get_generic_prompt(self) -> str:
        """Generic extraction prompt when type is unknown"""
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
    
    def _upload_file(self, file_content: bytes, file_path: str) -> Dict[str, Any]:
        """Upload PDF to Kimi and get file object"""
        import os
        filename = os.path.basename(file_path)
        
        files = {
            'file': (filename, file_content, 'application/pdf')
        }
        
        response = self.client.post(
            "/files",
            files=files
        )
        response.raise_for_status()
        return response.json()
    
    def _extract_with_kimi(self, file_obj: Dict[str, Any], system_prompt: str) -> Dict[str, Any]:
        """Extract data using Kimi chat completion"""
        # Create chat completion with file reference
        response = self.client.post(
            "/chat/completions",
            json={
                "model": "kimi-latest",
                "messages": [
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "file",
                                "file_url": {
                                    "url": file_obj.get("url")
                                }
                            },
                            {
                                "type": "text",
                                "text": "Extract all financial data from this statement and return as JSON."
                            }
                        ]
                    }
                ],
                "temperature": 0.1,  # Low temperature for consistent extraction
                "max_tokens": 4000
            }
        )
        response.raise_for_status()
        
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        
        # Parse JSON from content
        try:
            # Clean up markdown formatting if present
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
                "usage": result.get("usage", {})
            }
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"Failed to parse JSON: {str(e)}",
                "raw_response": content,
                "data": None
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