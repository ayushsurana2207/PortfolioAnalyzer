import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Dict

from app.config import get_settings

logger = logging.getLogger("notifications")


def format_inr_currency(value: float) -> str:
    """Formats a number into INR currency string with commas."""
    return f"₹ {value:,.0f}"


async def send_email_notification(subject: str, html_content: str) -> None:
    """Asynchronously dispatches an HTML email to the configured recipient.
    
    Queries the AppSetting database table first to support dynamic UI-based configurations,
    falling back to static environment variables if database configurations are absent.
    """
    settings = get_settings()
    
    # Initialize with static environment configurations
    host = settings.SMTP_HOST
    port = settings.SMTP_PORT
    username = settings.SMTP_USERNAME
    password = settings.SMTP_PASSWORD
    sender = settings.SMTP_SENDER
    recipient = settings.ALERT_RECIPIENT_EMAIL
    
    # Override with database settings if present
    from app.database import SessionLocal
    from app.models.settings import AppSetting
    from sqlmodel import select
    
    try:
        with SessionLocal() as session:
            db_settings = session.exec(select(AppSetting)).all()
            db_map = {s.key: s.value for s in db_settings}
            
            if "smtp_host" in db_map and db_map["smtp_host"]: 
                host = db_map["smtp_host"]
            if "smtp_port" in db_map and db_map["smtp_port"]: 
                try:
                    port = int(db_map["smtp_port"])
                except ValueError:
                    pass
            if "smtp_username" in db_map and db_map["smtp_username"]: 
                username = db_map["smtp_username"]
            if "smtp_password" in db_map and db_map["smtp_password"]: 
                password = db_map["smtp_password"]
            if "smtp_sender" in db_map and db_map["smtp_sender"]: 
                sender = db_map["smtp_sender"]
            if "alert_recipient_email" in db_map and db_map["alert_recipient_email"]: 
                recipient = db_map["alert_recipient_email"]
    except Exception as e:
        logger.error(f"Failed to query SMTP configs from DB, using env: {e}")

    # Safety checks
    if not all([host, port, username, password, sender, recipient]):
        logger.warning("SMTP email credentials are not fully configured (missing in DB and env). Skipping email dispatch.")
        return

    def _send_blocking():
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = sender
            msg["To"] = recipient
            
            # Attach HTML content
            msg.attach(MIMEText(html_content, "html"))
            
            # Establish connection and transmit
            with smtplib.SMTP(host, port) as server:
                server.starttls()
                server.login(username, password)
                server.sendmail(sender, recipient, msg.as_string())
                
            logger.info(f"Email alert successfully sent: '{subject}' to {recipient}")
        except Exception as e:
            logger.error(f"SMTP email dispatch failed: {e}")
            raise e


    # Offload blocking SMTP call to a thread pool
    try:
        await asyncio.to_thread(_send_blocking)
    except Exception as e:
        # Catch locally to avoid crashing calling services, but log it
        logger.error(f"Failed to execute background email dispatch: {e}")


async def send_flags_notification(flags: List[Dict], total_value_inr: float) -> None:
    """Formats and sends daily portfolio health risk flags via Email."""
    settings = get_settings()
    net_worth_str = format_inr_currency(total_value_inr)
    dashboard_url = settings.FRONTEND_URL
    
    # Build list elements for each flag
    flags_html = ""
    for flag in flags:
        severity = flag.get("severity", "WARNING").upper()
        icon = "⚠️" if severity == "WARNING" else "ℹ️"
        color = "#DC2626" if severity == "WARNING" else "#2563EB"
        title = flag.get("title", "Alert")
        message = flag.get("message", "")
        
        # Link if available
        link_html = ""
        if flag.get("url"):
            link_html = f'<br><a href="{flag["url"]}" style="color: #4F46E5; font-size: 13px; text-decoration: none;">Read related article &rarr;</a>'
            
        flags_html += f"""
        <div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid {color}; background-color: #F9FAFB; border-radius: 0 6px 6px 0;">
            <span style="font-size: 18px; margin-right: 8px;">{icon}</span>
            <strong style="color: #111827; font-size: 15px;">{title}</strong>
            <p style="margin: 6px 0 0 0; color: #4B5563; font-size: 14px; line-height: 1.5;">{message}{link_html}</p>
        </div>
        """
        
    subject = f"🚨 Portfolio Flag Alert — Net Worth: {net_worth_str}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #374151; line-height: 1.6; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #E5E7EB; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
            .header {{ border-bottom: 2px solid #F3F4F6; padding-bottom: 15px; margin-bottom: 20px; }}
            .title {{ font-size: 20px; font-weight: 600; color: #111827; margin: 0; }}
            .networth {{ font-size: 24px; font-weight: 700; color: #059669; margin: 10px 0 0 0; }}
            .footer {{ margin-top: 30px; padding-top: 15px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 12px; color: #9CA3AF; }}
            .btn {{ display: inline-block; padding: 10px 20px; margin-top: 15px; background-color: #4F46E5; color: white !important; text-decoration: none; border-radius: 6px; font-weight: 500; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <p class="title">🚨 Portfolio Flag Alert</p>
                <p class="networth">{net_worth_str} <span style="font-size: 14px; font-weight: normal; color: #6B7280;">(Vested Net Worth)</span></p>
            </div>
            
            <p style="font-size: 15px; color: #374151;">The daily rule-based flag engine has detected the following items requiring your attention:</p>
            
            <div style="margin-top: 25px;">
                {flags_html}
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <a href="{dashboard_url}" class="btn">View Portfolio Dashboard</a>
            </div>
            
            <div class="footer">
                <p>This is an advisory alert generated by your Portfolio AI Agent. All decisions are advisory only.</p>
                <p>&copy; {date_today().year} Personal Portfolio AI</p>
            </div>
        </div>
    </body>
    </html>
    """
    await send_email_notification(subject, html_content)


async def send_monthly_review_notification(result: dict) -> None:
    """Formats and sends the monthly executive portfolio review via Email."""
    settings = get_settings()
    health = result.get("portfolio_health", "FAIR").upper()
    summary = result.get("health_summary", "")
    suggestions = result.get("suggestions", []) or []
    dashboard_url = settings.FRONTEND_URL

    # Health mapping
    health_emoji = "✅" if health == "GOOD" else "⚡" if health == "FAIR" else "🔴"
    health_color = "#059669" if health == "GOOD" else "#D97706" if health == "FAIR" else "#DC2626"
    
    # Format top recommendations
    suggestions_html = ""
    # Sort suggestions by priority
    sorted_suggestions = sorted(suggestions, key=lambda x: x.get("priority", 99))
    top_suggestions = sorted_suggestions[:3]  # Focus on top 3
    
    for sug in top_suggestions:
        sug_type = sug.get("type", "WATCH").upper()
        asset_name = sug.get("asset_name") or "Asset"
        action = sug.get("action", "")
        reason = sug.get("reasoning", "")
        urgency = sug.get("urgency", "LOW").upper()
        
        urgency_emoji = "🔥" if urgency == "HIGH" else "⏳" if urgency == "MEDIUM" else "💬"
        
        suggestions_html += f"""
        <div style="margin-bottom: 15px; padding: 12px; border: 1px solid #E5E7EB; border-radius: 6px; background-color: #FFFFFF;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 4px; background-color: #EEF2F6; color: #475569;">
                    {sug_type} • {asset_name}
                </span>
                <span style="font-size: 13px;">
                    Urgency: {urgency_emoji} {urgency}
                </span>
            </div>
            <strong style="color: #111827; font-size: 14px;">{action}</strong>
            <p style="margin: 4px 0 0 0; color: #6B7280; font-size: 13px; line-height: 1.4;">{reason}</p>
        </div>
        """
        
    subject = f"{health_emoji} Monthly Portfolio Review: {health}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #374151; line-height: 1.6; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #E5E7EB; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }}
            .header {{ border-bottom: 2px solid #F3F4F6; padding-bottom: 15px; margin-bottom: 20px; }}
            .title {{ font-size: 20px; font-weight: 600; color: #111827; margin: 0; }}
            .health-badge {{ display: inline-block; padding: 4px 12px; font-weight: bold; border-radius: 20px; font-size: 14px; margin-top: 10px; }}
            .section-title {{ font-size: 16px; font-weight: 600; color: #111827; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin: 25px 0 12px 0; }}
            .footer {{ margin-top: 30px; padding-top: 15px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 12px; color: #9CA3AF; }}
            .btn {{ display: inline-block; padding: 10px 20px; margin-top: 15px; background-color: #4F46E5; color: white !important; text-decoration: none; border-radius: 6px; font-weight: 500; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <p class="title">📊 Monthly Portfolio Executive Review</p>
                <div class="health-badge" style="background-color: {health_color}15; color: {health_color};">
                    {health_emoji} Status: {health}
                </div>
            </div>
            
            <p style="font-size: 15px; font-weight: 500; color: #111827; margin-bottom: 8px;">Executive Summary:</p>
            <p style="margin: 0; font-size: 14px; color: #4B5563; line-height: 1.5; font-style: italic; padding: 12px; background-color: #F9FAFB; border-radius: 6px; border-left: 3px solid #6B7280;">
                "{summary}"
            </p>
            
            <div class="section-title">🎯 Top 3 Strategic Recommendations</div>
            <div style="margin-top: 10px;">
                {suggestions_html}
            </div>
            
            <p style="font-size: 13px; color: #9CA3AF; margin-top: 20px;">
                *Past suggestions retrospective has been successfully run, and lessons learned have been incorporated into these recommendations.
            </p>
            
            <div style="text-align: center; margin-top: 30px;">
                <a href="{dashboard_url}" class="btn">View Complete Analysis</a>
            </div>
            
            <div class="footer">
                <p>This is a monthly automated review generated by your Portfolio AI Agent based on your historical statements.</p>
                <p>&copy; {date_today().year} Personal Portfolio AI</p>
            </div>
        </div>
    </body>
    </html>
    """
    await send_email_notification(subject, html_content)


async def send_test_notification() -> None:
    """Sends a connection and configuration verification email."""
    subject = "✅ Portfolio Agent: Notification Service Connected"
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
    </head>
    <body style="font-family: sans-serif; color: #374151; padding: 20px;">
        <div style="max-width: 500px; margin: auto; padding: 20px; border: 1px solid #E5E7EB; border-radius: 8px;">
            <h3 style="color: #10B981; margin-top: 0;">✅ Connection Verified</h3>
            <p>Your Portfolio AI Agent has successfully established a connection with your SMTP server.</p>
            <p>You will now receive:</p>
            <ul>
                <li><strong>Daily Risk Alerts:</strong> Triggered whenever high-risk concentration, drawdowns, or adverse news is detected.</li>
                <li><strong>Monthly Reviews:</strong> A comprehensive strategic analysis of your net worth growth and asset allocation adjustments.</li>
            </ul>
            <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="font-size: 12px; color: #9CA3AF; text-align: center; margin-bottom: 0;">
                Generated at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
            </p>
        </div>
    </body>
    </html>
    """
    await send_email_notification(subject, html_content)


def date_today() -> date:
    """Helper to get local date."""
    return date.today()
