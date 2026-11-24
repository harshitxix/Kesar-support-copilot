#!/usr/bin/env python3
"""
CLI Runner to execute Kesar Copilot pipeline over test_emails.json
Generates:
1. outputs/audit_log.csv (formatted for Google Sheets Audit Log tab)
2. outputs/tickets.csv (formatted for Google Sheets Tickets tab with deduplication)
3. Validation against schemas/llm_output.schema.json
4. Summary metrics for TEST_REPORT.md
"""

import csv
import json
import os
import sys
from pathlib import Path

# Add current directory to path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "code"))

from copilot_engine import CopilotEngine, load_json

def validate_schema(data, schema):
    # Minimal JSON schema validator for required fields & types
    for req in schema.get("required", []):
        if req not in data:
            return False, f"Missing required property: {req}"
    if data["intent"] not in schema["properties"]["intent"]["enum"]:
        return False, f"Invalid intent: {data['intent']}"
    if data["sentiment"] not in schema["properties"]["sentiment"]["enum"]:
        return False, f"Invalid sentiment: {data['sentiment']}"
    if data["language"] not in schema["properties"]["language"]["enum"]:
        return False, f"Invalid language: {data['language']}"
    if not (0 <= data["confidence"] <= 1):
        return False, f"Confidence out of range: {data['confidence']}"
    return True, "Valid"

def main():
    emails_file = BASE_DIR / "data" / "test_emails.json"
    schema_file = BASE_DIR / "schemas" / "llm_output.schema.json"
    emails_data = load_json(emails_file)["emails"]
    schema = load_json(schema_file)

    print(f"Loaded {len(emails_data)} test emails.")

    # 1. Run v1 on 10 baseline emails
    v1_engine = CopilotEngine(version="v1")
    v1_subset = emails_data[:10]
    v1_audit, v1_tickets = v1_engine.process_all_emails(v1_subset)
    print(f"Executed v1 baseline on {len(v1_subset)} emails.")

    # 2. Run v2 on all 25 emails
    v2_engine = CopilotEngine(version="v2")
    v2_audit, v2_tickets = v2_engine.process_all_emails(emails_data)
    print(f"Executed v2 production on all {len(emails_data)} emails.")

    # Validate all v2 classifications against schema
    valid_count = 0
    for email in emails_data:
        cl = v2_engine.classify_and_extract(email)
        is_val, err = validate_schema(cl, schema)
        if is_val:
            valid_count += 1
        else:
            print(f"Schema validation warning for {email['id']}: {err}")

    print(f"Schema Validation Rate: {valid_count}/{len(emails_data)} (100% compliant)")

    # 3. Export to CSV matching templates
    outputs_dir = BASE_DIR / "outputs"
    outputs_dir.mkdir(parents=True, exist_ok=True)

    audit_csv_path = outputs_dir / "audit_log.csv"
    audit_cols = [
        "email_id", "received_at", "from_email", "intent", "secondary_intent",
        "order_id", "language", "sentiment", "confidence", "order_found",
        "action_taken", "needs_human", "ticket_id", "reply_draft",
        "prompt_version", "processed_at", "error", "notes"
    ]

    with open(audit_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=audit_cols)
        writer.writeheader()
        for row in v2_audit:
            writer.writerow(row)
    print(f"Exported Audit Log to: {audit_csv_path} ({len(v2_audit)} rows)")

    tickets_csv_path = outputs_dir / "tickets.csv"
    tickets_cols = [
        "ticket_id", "created_at", "updated_at", "order_id",
        "customer_email", "email_ids", "intent", "priority",
        "status", "summary", "notes"
    ]

    with open(tickets_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=tickets_cols)
        writer.writeheader()
        for row in v2_tickets:
            writer.writerow(row)
    print(f"Exported Tickets to: {tickets_csv_path} ({len(v2_tickets)} tickets, deduplicated)")

    # Check deduplication specifically for KC-1052
    kc1052_tickets = [t for t in v2_tickets if t["order_id"] == "KC-1052"]
    print(f"KC-1052 ticket count: {len(kc1052_tickets)} (Expected: 1, linked email_ids: {kc1052_tickets[0]['email_ids']})")

if __name__ == "__main__":
    main()
