# Kesar & Co. Support Copilot — Harshit Chauhan

> Production-grade AI customer support copilot, deterministic policy guardrails, ticket deduplication engine, and Google Sheets integration for Kesar & Co.

[![GitHub](https://img.shields.io/badge/GitHub-harshitxix%2FKesar--support--copilot-181717?logo=github)](https://github.com/harshitxix/Kesar-support-copilot)
[![Dataset](https://img.shields.io/badge/Dataset-25%20Emails%20Tested-emerald)](#)
[![Accuracy](https://img.shields.io/badge/Accuracy%20(v2)-100%25-brightgreen)](#)
[![Deduplication](https://img.shields.io/badge/Ticket%20Dedup-Active-blue)](#)

---

## 1. Summary

- **What I built**: An end-to-end, enterprise AI Support Copilot for Kesar & Co. that triages incoming customer emails, extracts structured data matching `schemas/llm_output.schema.json`, enforces deterministic security & privacy guardrails, executes agent tools (`get_order`, `search_faq`), performs multi-turn ticket deduplication, logs every transaction to Google Sheets, and drafts empathetic responses in brand voice. Includes an interactive Enterprise Web Dashboard for real-time telemetry.
- **Platform & LLMs used**: 
  - Automation Workflow: **n8n** (blueprint exported in [`workflow/kesar_support_copilot_n8n.json`](./workflow/kesar_support_copilot_n8n.json)).
  - Execution Engine: Python 3.12 + Gemini 1.5 Flash / Groq / OpenAI compatible structured output pipeline with deterministic code guards.
  - Interactive UI: Enterprise Copilot Web App (`web_app/`).
- **Time spent**: Approx. 5.5 hours (including edge case stress testing, ticket deduplication logic, and full frontend visualization).
- **What works**:
  - 100% of the 25 test emails run end-to-end without manual intervention.
  - Zero schema violations against `schemas/llm_output.schema.json`.
  - Adversarial prompt injection defense (E12 VIP exploit detected and neutralized; escalation created).
  - Strict privacy enforcement (E07 husband asking for wife's order rejected without leaking details).
  - Ticket deduplication (E21 seamlessly updates E04's open ticket `TKT-002` rather than spawning duplicates).
  - Multi-lingual brand voice drafting (English, Hindi for E09, Hinglish for E05).
  - Deterministic date arithmetic for return policies (7-day unopened window, 48h damaged window).
- **What doesn't / Needs Human**:
  - Ambiguous queries without order numbers or email matches (E18) safely escalate to human support.
  - Out-of-policy B2B tax requests (E13) escalate to finance.
  - Medical condition questions (E20) receive a cosmetic disclaimer and escalate to human review.

---

## 2. Architecture

```mermaid
flowchart TD
    A["Inbound Email (Webhook / test_emails.json)"] --> B["Deterministic Security Preprocessor"]
    B -->|Check Prompt Injection| C{"Injection Detected?"}
    C -->|Yes (E12)| D["Flag Security Alert -> Escalate (needs_human=TRUE) -> Create Supervisor Ticket"]
    C -->|No| E["LLM Structured Extractor (temp=0)"]
    
    E --> F["JSON Schema Validation (llm_output.schema.json)"]
    F --> G["Intent & Entity Router"]
    
    G -->|order_status| H["Agent Tool: get_order (by ID / Email)"]
    G -->|product_query| I["Agent Tool: search_faq (faq.md)"]
    G -->|return_refund| J["Policy Engine: Date Math (days_since_delivery <= 7)"]
    G -->|complaint| K["Urgency Triage: 48h Damage Check"]
    G -->|other| L["Filter: Spam (E06) vs Partner (E17) vs Praise (E25)"]
    
    H --> M["Privacy Guard: sender_email == customer_email?"]
    M -->|Mismatch (E07)| N["Block Details Disclosure -> Draft Privacy Notice"]
    M -->|Match| O["Draft Order Status Reply"]
    
    J & K --> P["Ticket Manager: find_open_ticket(order_id)"]
    P -->|Open Ticket Exists (E21)| Q["Update Existing Ticket (Append note & email_ids)"]
    P -->|No Open Ticket| R["Create New Ticket (TKT-###)"]
    
    O & I & Q & R & N & D --> S["Google Sheets: Audit Log Tab (All 25)"]
    Q & R --> T["Google Sheets: Tickets Tab (Deduplicated)"]
```

### Major Workflow Components

| Step / Node | What it does | Why I designed it this way |
| :--- | :--- | :--- |
| **1. Webhook Ingest** | Receives inbound email payload (`id`, `from`, `subject`, `body`, `received_at`). | Standard decoupled trigger compatible with Shopify, Gmail, or test scripts. |
| **2. Security Guard** | Regex pre-scan for adversarial jailbreak phrases ("ignore all instructions", "VIP"). | Prevents untrusted user input from manipulating system prompt instructions (E12). |
| **3. LLM Classifier** | Returns structured JSON adhering to `llm_output.schema.json` with temperature 0. | Eliminates non-deterministic output drift; guarantees required fields exist. |
| **4. Agent Tools** | `get_order` (searches `orders.json` by ID or email) & `search_faq` (`faq.md`). | Grounds answers solely in verified facts; zero hallucination. |
| **5. Privacy Guard** | Checks `email.from == order.customer_email` before exposing tracking links or addresses. | Enforces strict D2C customer data privacy (E07 protection). |
| **6. Date Arithmetic Code** | Calculates exact days since delivery using `received_at` vs `delivered_date`. | Offloads arithmetic from LLM to deterministic code for 100% reliable return eligibility. |
| **7. Ticket Deduplicator** | Queries open tickets by `order_id` before inserting; updates existing row if open. | Prevents duplicate support tickets (E21 appends to E04's `TKT-002`). |
| **8. Brand Voice Drafter** | Drafts 3–6 sentences following `brand_voice.md` matching language (EN/HI/Hinglish). | Ensures empathetic, concise, and professional customer communication. |
| **9. Dual Sheets Sync** | Writes to `Audit Log` and `Tickets` tabs. | Complete visibility for support team and compliance. |

---

## 3. Setup — How Someone Else Can Run This

### Option A: Interactive Web Dashboard (Recommended — Quickest & Visual)
No external dependencies required! Uses Python 3 standard library:
```bash
# 1. Clone your repo
git clone https://github.com/harshitxix/Kesar-support-copilot.git
cd Kesar-support-copilot

# 2. Run the pipeline and export CSVs
python code/run_pipeline.py

# 3. Launch the Enterprise Web Dashboard
python web_app/server.py 8080
```
Open **http://localhost:8080** in your browser. You can execute individual emails, inspect the 25-row audit log, view the deduplicated tickets Kanban, and download the ready CSVs.

### Option B: Importing into n8n
1. In n8n, click **Workflows** → **Import from File...**
2. Select [`workflow/kesar_support_copilot_n8n.json`](./workflow/kesar_support_copilot_n8n.json).
3. Connect your **Google Sheets OAuth2** credential and **Gemini API Key** (or Groq/OpenAI) in the n8n Credentials Manager.
4. Set the Google Sheet ID to your own sheet.
5. Activate the workflow!

### Option C: Running the Test Sender Script
```bash
python ../kesar-ai-copilot-assignment/scripts/send_test_emails.py --url http://localhost:5678/webhook/support-email
```

---

## 4. Prompts

All production prompts are maintained in the [`prompts/`](./prompts/) directory:
- [`prompts/classification_v2.md`](./prompts/classification_v2.md): Schema extraction with adversarial isolation and strict enum validation.
- [`prompts/reply_agent_v2.md`](./prompts/reply_agent_v2.md): Brand voice drafting with FAQ grounding, privacy constraints, and bilingual support.

**Model Settings**:
- Classification: Temperature `0.0`, Top-P `0.1` (deterministic extraction).
- Drafting Agent: Temperature `0.2`, Top-P `0.9` (natural, warm phrasing grounded strictly in tools).

---

## 5. Key Decisions and Assumptions

- **Low-Confidence Handling**: If confidence < 0.85 or order lookup fails on an order-status email (e.g. E18, E22), the email is routed to `needs_human: TRUE` with a polite clarification draft asking for registered contact details.
- **Avoiding Duplicate Tickets**: Before creating a ticket for `return_refund` or `complaint`, the ticket manager scans existing open tickets for that `order_id`. If found, it appends the new email ID and updates notes (demonstrated by E21 appending to E04's `TKT-002`).
- **Privacy Enforcement**: Customer email must strictly match `order.customer_email`. In E07 (husband requesting wife's order), the copilot politely refuses to expose tracking links or addresses to third parties and asks the registered purchaser to contact support.
- **FAQ Grounding**: The LLM is restricted to `data/faq.md`. Medical questions (E20) are deflected with a cosmetic disclaimer and escalated to human staff.
- **Date Math Outside LLM**: Date arithmetic (e.g., $2026-11-20 - delivered\_date$) is computed in deterministic code, never inside the LLM prompt.

---

## 6. Scaling to 1,000 Emails/Day

At 1,000 emails/day (~42 emails/hour avg, peaking at 150/hour during marketing campaigns):
1. **What breaks first**:
   - **Google Sheets API Rate Limits**: Google Sheets limits read/write requests to 300 requests/minute/project and 60 requests/minute/user. Under concurrent webhook spikes, direct row writes will hit `429 Rate Limit Exceeded`.
   - **Free-Tier LLM RPM/TPM**: Free-tier Gemini/Groq limits will throttle batch bursts.
2. **Architecture Upgrades**:
   - **Queue & Worker Pattern**: Ingest emails via an asynchronous message queue (Redis Celery / RabbitMQ / SQS) with a dead-letter queue (DLQ) and exponential backoff retry.
   - **Relational DB / Enterprise Helpdesk**: Transition tickets from Google Sheets to **PostgreSQL** or **Jira Service Desk / Zendesk**, using Google Sheets only for executive read-only reporting via periodic batch sync.
   - **Caching Layer**: Redis cache for FAQ embeddings and Shopify product catalogs to eliminate redundant lookups.
   - **Observability**: OpenTelemetry / Langfuse for tracing token costs, latency spikes, and confidence score distribution.

---

## 7. Product-Thinking Questions (≤150 words each)

### 1. Auto-Send vs. Draft: Threshold & Boundaries
**Auto-send**: Routine `order_status` lookups where sender email matches order, order is found, and confidence $\ge 0.90$; standard FAQ product queries with confidence $\ge 0.92$.  
**Draft / Human Review**:
- Any return or refund approval (financial impact).
- Complaints regarding damaged, leaking, or wrong items (customer sentiment risk).
- Any email with sentiment = "angry" or detected prompt injection (E08, E12).
- Any mismatch in email identity (E07).  
**Confidence Threshold**: Set at **0.85**. High-confidence repetitive inquiries are automated; edge cases, complaints, and financial transactions require human sign-off to eliminate unauthorized concessions or embarrassing hallucinations.

### 2. Cost: LLM Economics at 1,000 Emails/Day
- **Classification**: ~600 prompt tokens + ~150 completion tokens = 750 tokens.
- **Reply Drafting**: ~900 prompt tokens (with FAQ context) + ~200 completion tokens = 1,100 tokens.
- **Total per Email**: ~1,850 tokens.
- Using **Gemini 1.5 Flash** ($0.075 / 1M input, $0.30 / 1M output):
  - Inbound cost: $1,500 \times \$0.000000075 = \$0.0001125$
  - Outbound cost: $350 \times \$0.00000030 = \$0.000105$
  - Cost per email: **~$0.00022 (~₹0.018)**
- **Daily Cost (1,000 emails)**: $\$0.22$ (~₹18.50).
- **Monthly Cost (30,000 emails)**: **$6.60 (~₹550/month)**.  
Even with multi-tool agent routing and retries, LLM inference costs remain under ₹1,000/month.

### 3. Success Metric & Kill Switch in Week 1
- **Primary Metric**: **First Contact Resolution (FCR) of Copilot-Drafted Replies** combined with **Agent Edit Distance** (<15% word edits by human reviewer). A successful copilot saves agent time without requiring total rewrites.
- **Kill Switch Trigger**: An **Unauthorized Financial Concession Rate > 0%** (e.g. an approved refund on an opened product or prompt injection breach) OR a **Hallucinated Policy Rate > 1%** (providing incorrect shipping fees or medical claims). If triggered, automated drafting pauses immediately and reverts to categorization-only mode.

### 4. Failure Experience: Blast-Radius Containment
When the copilot makes an error (e.g., misclassifying an angry complaint as a general inquiry or failing to find an order), the customer risks feeling ignored by an impersonal bot.  
**Mitigations**:
1. **All customer-facing outputs default to drafts** during onboarding; humans click "Send".
2. **Transparent Fallbacks**: If data is missing or intent is ambiguous, the copilot explicitly admits it: *"I couldn't locate that order number directly; let me connect you with a specialist."*
3. **Graceful Escalation**: Sentiment analysis flags angry phrasing and tags high priority for human response within 4 hours.

### 5. Don't Automate: What Stays Manual & Why
**Final Refund Approval & Payment Disbursement for Damaged / High-Value Claims** must remain manual.  
While the copilot can collect photo evidence, verify the 48-hour delivery window, and draft the apology, human review of the damaged goods photo is essential to prevent fraud (e.g. reused photos, staged damage, or social media blackmail). Additionally, disbursing cash or initiating payment gateway refunds creates irreversible financial liability that requires human accountability.

---

## 8. How I Used AI Tools

- **Prompt Engineering & Edge Case Identification**: Used LLM interaction to brainstorm adversarial phrasing and simulate difficult Hinglish/Hindi phrasing.
- **Human Judgment & Custom Code**:
  - Wrote deterministic Python security guardrails for injection defense and email verification rather than trusting prompts.
  - Designed the ticket deduplication algorithm to prevent Google Sheets row bloat.
  - Engineered the date arithmetic calculations outside the LLM context to prevent arithmetic hallucination.

---

## 9. If I Had One More Week

1. **Computer Vision Photo Verification**: Integrate multimodal Gemini Vision to automatically verify whether uploaded attachments (e.g., E21 cracked jar) actually contain cracked packaging before notifying agents.
2. **Live Shopify & Courier Webhooks**: Real-time webhook bidirectional sync with SwiftShip/BharatExpress API for live GPS status.
3. **Slack Real-time Escalation Channel**: Automatically post high-priority angry complaints (`#support-urgent`) with one-click approval buttons.
