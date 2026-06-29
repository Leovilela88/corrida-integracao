"""Envio de e-mail transacional via SMTP (sem dependências externas).

Configuração por variáveis de ambiente (defina no Railway quando tiver um
provedor — Brevo, Resend, Gmail, etc.):

    SMTP_HOST      ex: smtp-relay.brevo.com
    SMTP_PORT      ex: 587 (STARTTLS) ou 465 (SSL)
    SMTP_USER      usuário/login do SMTP
    SMTP_PASS      senha/chave do SMTP
    MAIL_FROM      remetente, ex: nao-responda@corridaintegracao.app.br
    MAIL_FROM_NAME opcional, ex: Corrida Integração

Enquanto não estiver configurado, `is_configured()` é False e o app apenas
registra o link no log (dá pra testar o fluxo sem enviar de verdade).
"""
import json
import os
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage


def is_configured() -> bool:
    return all(os.environ.get(k) for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"))


def _send_via_resend_api(sender: str, from_name: str, to: str, subject: str,
                         html: str, text: str, api_key: str) -> bool:
    """Envia pela API HTTP do Resend (porta 443). O Railway bloqueia SMTP de
    saída, então este é o caminho confiável quando SMTP_HOST é o Resend."""
    payload = json.dumps({
        "from": f"{from_name} <{sender}>",
        "to": [to],
        "subject": subject,
        "html": html,
        "text": text or "Abra este e-mail em um cliente compatível com HTML.",
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails", data=payload, method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            # UA explícito: o User-Agent padrão do urllib é bloqueado pelo
            # bot-protection do Cloudflare na frente da API (erro 1010).
            "User-Agent": "corrida-integracao/1.0 (+https://app.corridaintegracao.app.br)",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            print(f"[emailer] enviado para {to} via Resend API (HTTP {resp.status})", flush=True)
            return True
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:300]
        print(f"[emailer] FALHA Resend API (HTTP {e.code}): {body}", flush=True)
        return False
    except Exception as e:
        print(f"[emailer] FALHA Resend API: {e!r}", flush=True)
        return False


def send_email(to: str, subject: str, html: str, text: str = "") -> bool:
    """Envia um e-mail. Retorna True se enviou, False se não há SMTP configurado
    ou se falhou (sem nunca levantar exceção para o caller)."""
    if not is_configured():
        missing = [k for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM")
                   if not os.environ.get(k)]
        print(f"[emailer] SMTP nao configurado; faltam variaveis: {missing}", flush=True)
        return False
    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ["SMTP_USER"]
    pwd = os.environ["SMTP_PASS"]
    sender = os.environ["MAIL_FROM"]
    from_name = os.environ.get("MAIL_FROM_NAME", "Corrida Integração")

    # Resend: usa a API HTTP (porta 443), pois o Railway bloqueia SMTP de saída.
    if host.endswith("resend.com"):
        return _send_via_resend_api(sender, from_name, to, subject, html, text, pwd)

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{sender}>"
    msg["To"] = to
    msg.set_content(text or "Abra este e-mail em um cliente compatível com HTML.")
    msg.add_alternative(html, subtype="html")

    try:
        if port == 465:
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=ctx, timeout=15) as s:
                s.login(user, pwd)
                s.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as s:
                s.starttls(context=ssl.create_default_context())
                s.login(user, pwd)
                s.send_message(msg)
        print(f"[emailer] enviado para {to} via {host}:{port}", flush=True)
        return True
    except Exception as e:
        print(f"[emailer] FALHA SMTP ({host}:{port}, user={user}): {e!r}", flush=True)
        return False


def password_reset_html(name: str, link: str) -> tuple[str, str]:
    """Retorna (html, texto) do e-mail de redefinição de senha."""
    text = (
        f"Olá, {name}!\n\n"
        f"Recebemos um pedido para redefinir a sua senha no Corrida Integração.\n"
        f"Abra o link abaixo (válido por 1 hora):\n\n{link}\n\n"
        f"Se não foi você, pode ignorar este e-mail.\n"
    )
    html = f"""\
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
  <h2 style="color:#04132f">Redefinir senha</h2>
  <p>Olá, <strong>{name}</strong>!</p>
  <p>Recebemos um pedido para redefinir a sua senha no <strong>Corrida Integração</strong>.</p>
  <p style="margin:24px 0">
    <a href="{link}" style="background:#05e0a3;color:#04132f;text-decoration:none;
       font-weight:700;padding:12px 22px;border-radius:10px;display:inline-block">
       Criar nova senha</a>
  </p>
  <p style="color:#64748b;font-size:13px">O link é válido por 1 hora. Se não foi você que pediu, é só ignorar este e-mail.</p>
</div>"""
    return html, text
