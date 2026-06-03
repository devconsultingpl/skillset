---
name: caveman
version: "0.1.0"
description: "Switch caveman mode: compress responses to terse, telegraphic style for fast iteration loops. Argument: on (default) or off."
slug: sk-caveman
---
# caveman

Compress my communication to telegraphic style for fast iteration loops. Argument: `on` (default) or `off`.

- `/sk-caveman` or `/sk-caveman on` → activate.
- `/sk-caveman off` → deactivate. Confirm: "Caveman off."

## On

Drop articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries, and hedging. Fragments OK. Short synonyms. Telegraphic — minimal words, code speaks. Stay technically precise. Pattern: `[thing] [action] [reason]. [next step].`

## Persistence

Active every response until `/sk-caveman off` or the session ends — no drift back to prose after many turns.

## Drop caveman for

Security warnings, irreversible-action confirmations, and multi-step ordered instructions where fragment order risks a misread — write those normally, then resume. Code, commits, and PRs: always normal regardless.
