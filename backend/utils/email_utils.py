import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USER = os.environ.get('EMAIL_USER', '')
EMAIL_PASSWORD = os.environ.get('EMAIL_PASSWORD', '')
EMAIL_FROM = os.environ.get('EMAIL_FROM', EMAIL_USER)

def send_email(to_email, subject, body):
    if not EMAIL_USER or not EMAIL_PASSWORD:
        logger.warning("이메일 설정이 되어 있지 않아 실제 전송되지 않았습니다.")
        logger.info(f"전송 예정 이메일: 수신자={to_email}, 제목={subject}")
        return True
    
    try:
        msg = MIMEMultipart()
        msg['From'] = EMAIL_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        
        logger.info(f"SMTP 서버 연결 시도: {EMAIL_HOST}:{EMAIL_PORT}")
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.starttls()
            server.login(EMAIL_USER, EMAIL_PASSWORD)
            server.send_message(msg)
            
        logger.info(f"이메일 전송 성공: {to_email}")
        return True
    except Exception as e:
        logger.error(f"이메일 전송 실패: {str(e)}")
        logger.debug(f"이메일 설정: HOST={EMAIL_HOST}, PORT={EMAIL_PORT}, USER={EMAIL_USER}")
        return False

def send_password_reset_email(email, temp_password):
    subject = "비밀번호 재설정 안내"
    body = f"""
안녕하세요,

요청하신 비밀번호 재설정 안내입니다.
임시 비밀번호: {temp_password}

로그인 후 비밀번호를 변경해주세요.

감사합니다.
    """
    
    return send_email(email, subject, body) 