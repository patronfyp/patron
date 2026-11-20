"""One look for every email PATRON sends: a plain-text version and an HTML one
built from the same parts (ADR 0022).

Email clients ignore stylesheets and modern CSS, so the HTML is tables with
inline styles. Every value is escaped: names and company names are typed by
users and must never become markup or links.
"""

from dataclasses import dataclass
from html import escape

# Colours from frontend/src/config/theme.js (Figma PATRON 2.0).
_CANVAS = "#f7f6f1"
_SURFACE = "#ffffff"
_BORDER = "#e1ddd2"
_TEXT = "#22262b"
_TEXT_SECONDARY = "#4a4842"
_TEXT_TERTIARY = "#67645b"
_ACCENT = "#0c8558"
_ACCENT_SUBTLE = "#e9f6ef"
_ACCENT_TEXT = "#0a6b47"
_FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"


@dataclass(frozen=True)
class Email:
    subject: str
    text: str
    html: str


def compose(
    *,
    subject: str,
    heading: str,
    lines: list[str],
    code: str | None = None,
    button: tuple[str, str] | None = None,
    footer: str,
) -> Email:
    """Build both versions of one email.

    `lines` are paragraphs, `code` a one-time code shown large, `button` a
    (label, url) call to action, and `footer` the "if this wasn't you" note.
    """
    return Email(
        subject=subject,
        text=_text(heading, lines, code, button, footer),
        html=_html(heading, lines, code, button, footer),
    )


def _text(
    heading: str,
    lines: list[str],
    code: str | None,
    button: tuple[str, str] | None,
    footer: str,
) -> str:
    parts = [heading, *lines]
    if code:
        parts.append(code)
    if button:
        parts.append(f"{button[0]}:\n{button[1]}")
    parts.append(footer)
    return "\n\n".join(parts) + "\n\n- PATRON"


def _html(
    heading: str,
    lines: list[str],
    code: str | None,
    button: tuple[str, str] | None,
    footer: str,
) -> str:
    paragraphs = "".join(
        f'<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:{_TEXT_SECONDARY}">'
        f"{escape(line)}</p>"
        for line in lines
    )
    code_block = (
        f'<p style="margin:8px 0 24px;padding:16px;border-radius:10px;background:{_ACCENT_SUBTLE};'
        f"text-align:center;font-size:32px;line-height:40px;font-weight:700;letter-spacing:8px;"
        f'color:{_ACCENT_TEXT}">{escape(code)}</p>'
        if code
        else ""
    )
    button_block = ""
    if button:
        label, url = (escape(part, quote=True) for part in button)
        button_block = (
            f'<p style="margin:8px 0 24px"><a href="{url}" style="display:inline-block;'
            f"padding:12px 20px;border-radius:10px;background:{_ACCENT};color:#ffffff;"
            f'font-size:15px;font-weight:600;text-decoration:none">{label}</a></p>'
            f'<p style="margin:0 0 16px;font-size:13px;line-height:20px;color:{_TEXT_TERTIARY}">'
            f'Or open this link: <a href="{url}" style="color:{_ACCENT_TEXT};word-break:break-all">'
            f"{url}</a></p>"
        )
    return (
        '<!doctype html><html><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        f'<body style="margin:0;padding:0;background:{_CANVAS};font-family:{_FONT}">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:{_CANVAS};padding:32px 16px"><tr><td align="center">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="max-width:520px">'
        f'<tr><td style="padding:0 4px 16px;font-size:18px;font-weight:700;color:{_TEXT}">'
        "PATRON</td></tr>"
        f'<tr><td style="padding:32px;border:1px solid {_BORDER};border-radius:16px;'
        f'background:{_SURFACE}">'
        f'<h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:{_TEXT}">'
        f"{escape(heading)}</h1>"
        f"{paragraphs}{code_block}{button_block}"
        f'<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:{_TEXT_TERTIARY}">'
        f"{escape(footer)}</p>"
        "</td></tr>"
        f'<tr><td style="padding:16px 4px 0;font-size:12px;color:{_TEXT_TERTIARY}">'
        "Vouched, Verified, Hired.</td></tr>"
        "</table></td></tr></table></body></html>"
    )
