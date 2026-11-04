/**
 * Phase 308-05 (D-11, A-27) — the "How to check the signature" snippets on the secret-once card.
 *
 * ⛔ THEY TAKE NO SECRET (the T-293-21 rule). Each reads it from `SYREL_WEBHOOK_SECRET`, so a builder
 *   can never put the secret on the page a second time. The functions take no argument at all, and
 *   `webhookSnippets.test.ts` pins that by arity.
 *
 * The import lines are the library's own: the Python one is exactly what the D-11 interop test
 * imports against `standardwebhooks==1.1.0`; the Node one follows the package README. Both verify
 * the RAW body — parsing the JSON first changes the bytes and the check fails.
 */

export const WEBHOOK_SECRET_ENV = "SYREL_WEBHOOK_SECRET"

export function pythonSnippet(): string {
  return [
    "pip install standardwebhooks",
    "",
    "import os",
    "from standardwebhooks.webhooks import Webhook",
    "",
    `wh = Webhook(os.environ["${WEBHOOK_SECRET_ENV}"])`,
    "event = wh.verify(raw_body, headers)  # raises if it isn't from Syrel",
  ].join("\n")
}

export function nodeSnippet(): string {
  return [
    "npm install standardwebhooks",
    "",
    'import { Webhook } from "standardwebhooks";',
    "",
    `const wh = new Webhook(process.env.${WEBHOOK_SECRET_ENV});`,
    "const event = wh.verify(rawBody, headers); // throws if it isn't from Syrel",
  ].join("\n")
}
