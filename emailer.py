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
import os
import smtplib
import ssl
from email.message import EmailMessage


def is_configured() -> bool:
    return all(os.environ.get(k) for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"))


def send_email(to: str, subject: str, html: str, text: str = "") -> bool:
    """Envia um e-mail. Retorna True se enviou, False se não há SMTP configurado
    ou se falhou (sem nunca levantar exceção para o caller)."""
    if not is_configured():
        return False
    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ["SMTP_USER"]
    pwd = os.environ["SMTP_PASS"]
    sender = os.environ["MAIL_FROM"]
    from_name = os.environ.get("MAIL_FROM_NAME", "Corrida Integração")

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
        return True
    except Exception:
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
