import cx_Oracle
import logging
from .connection import get_db_connection

logger = logging.getLogger(__name__)

class DBConnectionManager:
    """
    데이터베이스 연결을 관리하는 컨텍스트 매니저
    with 구문을 통해 DB 연결과 트랜잭션을 자동으로 관리합니다.
    """
    def __init__(self):
        self.conn = None
        self.cursor = None
        
    def __enter__(self):
        self.conn = get_db_connection()
        self.cursor = self.conn.cursor()
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            # 예외가 발생한 경우 롤백
            if self.conn:
                self.conn.rollback()
        else:
            # 예외가 없으면 커밋
            if self.conn:
                self.conn.commit()
                
        # 리소스 정리
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
            
        return False  # 예외를 다시 발생시킴
    
    def execute(self, query, params=None):
        """SQL 쿼리 실행"""
        return self.cursor.execute(query, params or {})
    
    def fetchone(self):
        """단일 결과 조회"""
        result = self.cursor.fetchone()
        if result:
            columns = [col[0].lower() for col in self.cursor.description]
            return dict(zip(columns, result))
        return None
    
    def fetchall(self):
        """모든 결과 조회"""
        results = self.cursor.fetchall()
        if results:
            columns = [col[0].lower() for col in self.cursor.description]
            return [dict(zip(columns, row)) for row in results]
        return [] 