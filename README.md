# ContextKeeper

> **Product tagline:** Your files remember, so you don't have to.

ContextKeeper is an AI-powered personal knowledge library built for **Hacktoberfest 2026 (Open-Source AI Challenge, Week 3: Slow and Steady)**. It helps users find forgotten information, tutorials, research notes, and documentation across their personal files without having to manually organize, tag, or remember exact filenames.

---

## 1. Mandatory AI Architecture: Google Gemma Runtime

ContextKeeper strictly adheres to the requirement that **Google Gemma is the runtime model** for all document understanding, summarization, topic extraction, and contextual metadata generation.

- **Primary Runtime Model ID:** `gemma-4-26b-a4b-it` (Gemma 4 26B Instruction Tuned)
- **Fallback Candidate Model ID:** `gemma-4-31b-it`
- **Inference Endpoint:** Google AI Studio REST API (`https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it`)
- **API Key Configuration:** Handled exclusively server-side via `process.env.GEMINI_API_KEY`. No API keys or credentials are ever exposed in frontend bundles or client-side code.
- **Strict Separation:** Model selection, system instructions, and schemas are isolated in dedicated backend modules (`server/config.ts`, `server/gemma.ts`, `server/schemas.ts`).

---

## 2. Core Features Implemented End-to-End

### 1. Multi-Format Document Ingestion & Text Extraction
- Upload text-based **PDF**, **Markdown (.md)**, and **TXT** files via drag-and-drop or file picker.
- Server-side text extraction using `pdf-parse` with page-by-page mapping and word count tracking.
- Friendly error detection for unsupported formats, empty files, or scanned bitmap PDFs (with clear notice that scanned PDF OCR is out of scope for the MVP).

### 2. Automatic AI Indexing with Google Gemma
- For each uploaded document, Gemma generates:
  - **Concise summary** (2–3 sentences capturing the core intent).
  - **Topics & domain tags** (e.g. `#React`, `#Docker`, `#DevOps`).
  - **Specific keywords & named entities**.
  - **Document type classification** (Tutorial, Notes, Runbook, Guide, Specification, etc.).
  - **Distinctive phrases** (unique phrases from the text that a user who forgot the filename might remember).
  - **Explicit date mentions** (strictly verified against source dates).
  - **Suggested collections** (Web Development, DevOps, Research, Career Resources).
- **Zod Runtime Schema Validation:** Responses are validated before storage. If AI processing fails or rate limits are reached, extracted text is preserved for full-text search.

### 3. Natural Language Search & Candidate Retrieval
- Multi-tier retrieval pipeline:
  1. Deterministic scoring across titles, keywords, topics, distinctive phrases, and full-text content.
  2. Candidate window extraction with exact PDF page number attribution.
  3. Contextual candidate ranking.
- Gemma explains why the document answers the user's inquiry in natural language.
- Honest empty state when no relevant documents are found.

### 4. Evidence Integrity & Source Quote Verification
- Every search result displays the exact source snippet.
- If Gemma quotes a phrase, ContextKeeper verifies verbatim substring occurrence in the source text (`quoteVerified: boolean`).
- Clear visual badges distinguish **Verified Source Quotes** from synthesized text excerpts.

### 5. Smart Collections
- Automatically groups documents into suggested collections based on Gemma topics.
- Users can view collections, create custom collections, rename them, and add/remove documents.

### 6. Local Persistence & Privacy
- Single-user library persists locally in the browser's **IndexedDB** (`contextkeeper_db`).
- Documents and search indexes survive browser refreshes.
- Document removal deletes only the local IndexedDB record without touching original files on disk.
- Complete privacy disclosure modal explaining hosted inference versus local storage.

---

## 3. Scope Boundaries & Out of Scope for MVP

In accordance with PRD Section 11, the following are intentionally out of scope:
- User registration, login accounts, and passwords.
- Cloud database synchronization across devices.
- OCR for scanned bitmap PDFs without an embedded text layer.
- Autonomous file renaming, deletion, or moving on the user's computer.
- Conversational chat assistant or "Ask AI" chat widgets (ContextKeeper is a personal librarian, not a general chatbot).

---

## 4. Setup & Running Locally

### Prerequisites
- Node.js >= 20.x
- Google AI Studio API key with access to Gemma models

### Installation
```bash
# Clone the repository
git clone https://github.com/example/contextkeeper.git
cd contextkeeper

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Ensure GEMINI_API_KEY="YOUR_KEY" is set in .env
```

### Development
```bash
# Runs full-stack server on port 3000 with Vite middleware
npm run dev
```

### Production Build
```bash
npm run build
npm start
```
