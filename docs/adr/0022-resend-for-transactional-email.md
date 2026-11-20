# ADR 0022: Resend for transactional email

- **Status:** accepted
- **Date:** 2026-11-19
- **Decision by:** Rafay

## Context

PATRON emails three things: verification codes, password-reset links and
company invites. Every service sends through the `EmailSender` interface
(`app/core/email.py`), which had a console sender (prints to the terminal)
and an untested Resend sender sending plain text only (#111).

SendGrid was the other option considered.

## Decision

1. **Resend is the provider.** It is chosen with `EMAIL_BACKEND=resend` and
   `RESEND_API_KEY`; `console` stays the default for local work and tests.
2. **Every email has a plain-text and an HTML version**, built from the same
   parts by `compose()` in `app/core/email_layout.py`: a heading, paragraphs,
   an optional code or button, and a footer. The HTML uses tables and inline
   styles (email clients ignore stylesheets) and the Figma theme colours.
3. **Everything users type is escaped** in the HTML. Names and company names
   appear in invites, so unescaped they could add markup or phishing links.
4. **Production refuses the console backend** at startup, because it would
   write working codes and reset links into the logs.
5. **A refusal, a timeout or no connection is an `EmailDeliveryError`.** The
   callers already undo their work on it (the code or invite is dropped, the
   user is told to try again). Logs name the cause, never the content or key.
6. **No sending domain yet.** Until one is verified in Resend, mail is only
   delivered to the account owner's inbox, from `onboarding@resend.dev`.
   Verifying a domain (three DNS records) changes `EMAIL_FROM` only, no code;
   it goes with deployment (#114).

## Consequences

**Positive**
- Free tier (3,000 emails a month) covers the project; the sender was mostly
  written already.
- One layout for every email; a new email is one `compose()` call.
- Swapping providers is still one new class behind `EmailSender`.

**Negative**
- Until a domain is verified, only one inbox receives real email, so the team
  keeps `console` day to day.
- Sending happens inside the request, adding Resend's latency to it. The
  background queue (#113) moves it out.

## Alternatives considered
- **SendGrid** - rejected: as far as we know its permanent free plan has
  ended (a trial, then paid), its setup is heavier, and nothing was written
  for it.
- **Brevo** - viable (300 a day free, can send from one verified address
  without a domain), but would mean a new sender; kept as the fallback.
- **SMTP through Gmail** - rejected: low limits, app passwords, and mail from
  a personal address is often marked as spam.
