# Callback Handler (UI)

A lightweight tool to generate unique URLs for capturing, inspecting, and debugging HTTP requests (webhooks, callbacks, etc.) in real-time. Built with Next.js and Vercel KV.

## Features

- **Unique Slugs**: Generate random, date-stamped slugs (e.g., `x7z9-0112`) to ensure uniqueness and sorting needs in future.
- **Universal Capture**: Records ALL HTTP methods (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`, etc.).
- **Smart Detection**: automatically distinguishes between browser visits (to show the UI) and API requests (to be recorded).
- **Request Inspection**: View headers, body (JSON), query parameters, IP address, and timestamp.
- **Persistance**: Requests are stored in [Vercel KV](https://vercel.com/docs/storage/vercel-kv) (Redis). This is handled in the backend, currently using free tier as at Jan 12 2026.

## Technology Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Database**: [Vercel KV](https://vercel.com/docs/storage/vercel-kv) (Upstash Redis)
- **Styling**: Tailwind CSS (via `@vercel/examples-ui`)
- **Deployment**: Vercel
- **Version Control**: Github (Ofcourse)

## Getting Started

### Prerequisites

- Positive Attitude
- Node.js 18+
- A Vercel account (for KV storage)

### Installation

0. Housekeeping.

```bash
  - Please star the repo, it means a lot to me.
  - Raise issues if you find any.
  - Sponsor the project too, your support will go a long way.
```

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/patricmutwiri/callback-handler-ui.git
    cd callback-handler-ui
    ```

2.  **Install dependencies**:

    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Copy the example environment file:

    ```bash
    cp .env.example .env.local
    ```

    Fill in your Vercel KV credentials in `.env.local`:

    ```env
    KV_URL="redis://..."
    KV_REST_API_URL="https://..."
    KV_REST_API_TOKEN="..."
    KV_REST_API_READ_ONLY_TOKEN="..."
    ```

4.  **Run Locally**:
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### 1. Generate a Slug

Visit the home page. You can enter a custom slug or click **Random** to generate one (e.g., `my-test-0112`). Click **Start Recording** to proceed to your dashboard.

### 2. Send Requests

Use the generated URL to send any HTTP request.

**Example (cURL):**

```bash
curl -X POST http://localhost:3000/record/my-test-0112 \
  -H "Content-Type: application/json" \
  -d '{"event": "user_signup", "id": 123}'
```

**Example (Webhook):**
Configure your 3rd party service (Stripe, Slack, etc.) to allow the generated URL as the webhook endpoint.

### 3. Inspect Requests

Refresh the dashboard page (`/record/[slug]`) to see the incoming requests appear. You can see the method, timestamp, headers, and body payload.

## Deployment

Deploy easily with Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fpatricmutwiri%2Fcallback-handler-ui)

## Outro

Made with ❤️ for us by us. Happy Coding!
