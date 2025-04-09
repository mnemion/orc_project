import os
import logging
import cx_Oracle
from typing import Any, Dict, List, Optional, Union, Tuple
from dotenv import load_dotenv
from contextlib import contextmanager

load_dotenv()

logger = logging.getLogger(__name__)

DB_HOST = os.environ.get('DB_HOST')
DB_PORT = os.environ.get('DB_PORT')
DB_USER = os.environ.get('DB_USER')
DB_PASSWORD = os.environ.get('DB_PASSWORD')
DB_SERVICE = os.environ.get('DB_SERVICE')

required_vars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_SERVICE']
missing_vars = [var for var in required_vars if not os.environ.get(var)]
if missing_vars:
    logger.error(f"필수 환경 변수가 설정되지 않았습니다: {', '.join(missing_vars)}")
    raise ValueError(f"필수 환경 변수가 설정되지 않았습니다: {', '.join(missing_vars)}")

pool_initialized = False
connection_pool = None

def init_connection_pool(min_connections=1, max_connections=5, increment=1):
    global pool_initialized, connection_pool
    
    if pool_initialized:
        try:
            with get_cursor(should_commit=False) as cursor:
                cursor.execute("SELECT 1 FROM DUAL")
                result = cursor.fetchone()
                if result and result[0] == 1:
                    logger.debug("기존 Oracle 연결 풀 상태 양호")
                    return
                else:
                    logger.warning("기존 Oracle 연결 풀 상태 불량, 재초기화 시도")
                    try:
                        connection_pool.close()
                    except Exception as close_err:
                        logger.error(f"기존 연결 풀 닫기 실패: {str(close_err)}")
                    finally:
                        pool_initialized = False
        except Exception as check_err:
            logger.error(f"기존 Oracle 연결 풀 상태 확인 실패: {str(check_err)}")
            pool_initialized = False

    try:
        dsn = cx_Oracle.makedsn(DB_HOST, DB_PORT, service_name=DB_SERVICE)
        
        connection_pool = cx_Oracle.SessionPool(
            user=DB_USER,
            password=DB_PASSWORD,
            dsn=dsn,
            min=min_connections,
            max=max_connections,
            increment=increment,
            encoding="UTF-8",
            getmode=cx_Oracle.SPOOL_ATTRVAL_WAIT
        )
        connection_pool.timeout = 60
        
        pool_initialized = True
        logger.info("Oracle 연결 풀 초기화 성공")
    except Exception as e:
        logger.error(f"Oracle 연결 풀 초기화 실패: {str(e)}")
        raise

def get_db_connection():
    if not pool_initialized:
        init_connection_pool()
    
    try:
        connection = connection_pool.acquire()
        return connection
    except Exception as e:
        logger.error(f"Oracle 연결 실패: {str(e)}")
        raise

@contextmanager
def get_cursor(connection=None, should_commit=True):
    connection_created = False
    cursor = None
    
    try:
        if connection is None:
            connection = get_db_connection()
            connection_created = True
        
        cursor = connection.cursor()
        yield cursor
        
        if should_commit:
            try:
                connection.commit()
                logger.debug("트랜잭션 커밋 성공")
            except Exception as commit_err:
                logger.error(f"트랜잭션 커밋 실패: {str(commit_err)}")
                raise
    except Exception as e:
        try:
            if connection:
                connection.rollback()
                logger.warning(f"트랜잭션 롤백 실행: {str(e)}")
        except Exception as rollback_err:
            logger.error(f"트랜잭션 롤백 실패: {str(rollback_err)}")
        logger.error(f"쿼리 실행 오류: {str(e)}")
        raise
    finally:
        if cursor:
            try:
                cursor.close()
            except Exception as cursor_err:
                logger.error(f"커서 닫기 실패: {str(cursor_err)}")
                
        if connection_created and connection:
            try:
                connection_pool.release(connection)
                logger.debug("연결 풀에 연결 반환 성공")
            except Exception as release_err:
                logger.error(f"연결 풀에 연결 반환 실패: {str(release_err)}")

def ensure_serializable(data):
    try:
        if data is None:
            return None
        
        elif isinstance(data, cx_Oracle.LOB):
            try:
                return data.read()
            except Exception as e:
                logger.error(f"LOB 읽기 오류: {str(e)}")
                return ""
            
        elif hasattr(data, 'isoformat'):
            return data.isoformat()
        
        elif isinstance(data, tuple):
            return list(ensure_serializable(item) for item in data)
        
        elif isinstance(data, dict):
            result = {}
            for k, v in data.items():
                
                if isinstance(v, list) and len(v) == 1:
                    result[k] = ensure_serializable(v[0])
                else:
                    result[k] = ensure_serializable(v)
            return result
        
        elif isinstance(data, list):
            if len(data) == 1:
                
                if isinstance(data[0], (str, int)) and str(data[0]).isdigit():
                    return int(data[0])
                return ensure_serializable(data[0])
            return [ensure_serializable(item) for item in data]

        elif hasattr(data, '__dict__'):
            return ensure_serializable(data.__dict__)
        
        else:
            return data
    except Exception as e:
        logger.error(f"직렬화 변환 오류: {str(e)}, 데이터 타입: {type(data)}")

        if isinstance(data, (dict, list, tuple)):
            return {} if isinstance(data, dict) else []
        return str(data) if data is not None else None

def execute_query(sql: str, params: Optional[Dict[str, Any]] = None, fetch_one: bool = False) -> Union[List[Dict[str, Any]], Dict[str, Any], None]:
    """데이터베이스 쿼리를 실행하고 결과를 반환합니다 (로깅 및 처리 강화)."""
    result = None
    try:
        with get_cursor() as cursor:
            try:
                # 기본 디버그 로그만 유지
                logger.debug(f"쿼리 실행: {sql[:150]}...")

                if params:
                    cursor.execute(sql, params)
                else:
                    cursor.execute(sql)

                if fetch_one:
                    row = cursor.fetchone()
                    if not row:
                        return None

                    column_names = [col[0].lower() for col in cursor.description] if cursor.description else []
                    if isinstance(row, tuple) and column_names:
                         result_dict = {}
                         for idx, col_name in enumerate(column_names):
                             if idx < len(row):
                                 value = row[idx]

                                 if isinstance(value, cx_Oracle.LOB):
                                     try: 
                                         # CLOB 데이터 전체를 읽어오도록 수정
                                         result_dict[col_name] = value.read()
                                     except Exception as e: 
                                         logger.error(f"LOB 읽기 오류(fetch_one): {str(e)}, col: {col_name}")
                                         result_dict[col_name] = "[LOB 오류]"
                                 else: 
                                     result_dict[col_name] = value
                         result = result_dict
                    else:
                         result = row
                else:
                    rows = cursor.fetchall()
                    if not rows:
                        return []

                    column_names = [col[0].lower() for col in cursor.description] if cursor.description else []
                    result = []
                    
                    for row_idx, row in enumerate(rows):
                        if isinstance(row, tuple) and column_names:
                            row_dict = {}
                            for idx, col_name in enumerate(column_names):
                                if idx < len(row):
                                    value = row[idx]
                                    
                                    if isinstance(value, cx_Oracle.LOB):
                                        try:
                                            # CLOB 데이터 전체를 읽어오도록 수정
                                            lob_data = value.read()
                                            row_dict[col_name] = lob_data
                                        except Exception as e:
                                            logger.error(f"LOB 읽기 오류(fetch_all): {str(e)}, row: {row_idx}, col: {col_name}")
                                            row_dict[col_name] = "[LOB 오류]"
                                    else:
                                        row_dict[col_name] = value
                            result.append(row_dict)
                        else:
                            result.append(row)
            except cx_Oracle.Error as db_err:
                error_obj, = db_err.args
                logger.error(f"Oracle 데이터베이스 오류:")
                logger.error(f"  코드: {error_obj.code}, 메시지: {error_obj.message}")
                logger.error(f"  컨텍스트: {error_obj.context}")
                if sql: logger.error(f"  SQL: {sql[:500]}...")
                if params: logger.error(f"  매개변수: {params}")
                return [] if not fetch_one else None
    except Exception as e:
        logger.error(f"쿼리 실행 중 예외 발생: {str(e)}", exc_info=True)
        return [] if not fetch_one else None
    
    return result

def execute_update(sql: str, params: Dict[str, Any]) -> int:
    """UPDATE 쿼리를 실행하고 영향받은 행의 수를 반환합니다."""
    connection = None
    cursor = None
    affected_rows = 0
    try:
        connection = get_db_connection()
        if not connection:
            logger.error("DB 연결 가져오기 실패 (execute_update)")
            return 0

        cursor = connection.cursor()
        logger.debug(f"Executing UPDATE: Query='{sql[:100]}...', Params={params}")
        cursor.execute(sql, params)
        affected_rows = cursor.rowcount
        connection.commit()
        logger.debug(f"UPDATE executed successfully. Affected rows: {affected_rows}")
        return affected_rows
    except cx_Oracle.Error as db_err:
        error_obj, = db_err.args
        logger.error(f"Oracle DB Error during UPDATE:")
        logger.error(f"  Code: {error_obj.code}")
        logger.error(f"  Message: {error_obj.message}")
        logger.error(f"  Context: {error_obj.context}")
        logger.error(f"  Query: {sql[:500]}...")
        logger.error(f"  Params: {params}")
        if connection:
            try:
                connection.rollback()
                logger.info("Transaction rolled back due to DB error (UPDATE)")
            except Exception as rb_err:
                 logger.error(f"Rollback failed after DB error (UPDATE): {rb_err}")
        return 0
    except Exception as e:
        logger.error(f"Unexpected error during UPDATE execution: {str(e)}", exc_info=True)
        if connection:
            try:
                 connection.rollback()
                 logger.info("Transaction rolled back due to unexpected error (UPDATE)")
            except Exception as rb_err:
                 logger.error(f"Rollback failed after unexpected error (UPDATE): {rb_err}")
        return 0
    finally:
        if cursor:
            try:
                cursor.close()
            except Exception as cursor_err:
                 logger.warning(f"Cursor close failed (UPDATE): {cursor_err}") # 경고 수준으로 변경
        if connection:
            try:
                # 실제로는 풀링을 사용하면 release
                if connection_pool: # 풀이 초기화되었는지 확인
                    connection_pool.release(connection)
                    logger.debug("DB connection released to pool after UPDATE.")
                else:
                    connection.close()
                    logger.warning("Connection pool not initialized, closing connection directly (UPDATE).")
            except Exception as release_err:
                logger.error(f"Connection release/close failed (UPDATE): {release_err}")

def execute_insert(sql: str, params: Dict[str, Any], return_inserted: bool = False) -> Union[int, Dict[str, Any], None]:
    """INSERT 쿼리를 실행하고 결과를 반환합니다."""
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        if not connection:
            logger.error("DB 연결 가져오기 실패 (execute_insert)")
            return None if return_inserted else 0
            
        cursor = connection.cursor()
        logger.debug(f"Executing INSERT: Query='{sql[:100]}...', Returning: {return_inserted}")
        
        if return_inserted:
            out_params = {}
            in_params = {}
            for key, value in params.items():
                if key.startswith('out_'):
                    var_name = key
                    if var_name in ('out_id', 'out_is_bookmarked'):
                        out_params[key] = cursor.var(cx_Oracle.NUMBER)
                    elif var_name in ('out_created_at', 'out_updated_at'):
                        out_params[key] = cursor.var(cx_Oracle.DATETIME)
                    elif var_name == 'out_extracted_text':
                        out_params[key] = cursor.var(cx_Oracle.CLOB)
                    else:
                        out_params[key] = cursor.var(cx_Oracle.STRING)
                else:
                    in_params[key] = value
            exec_params = {**in_params, **out_params}
            cursor.execute(sql, exec_params)
            connection.commit()
            result = {}
            for key, var in out_params.items():
                col_name = key[4:]
                value = var.getvalue()
                if isinstance(value, cx_Oracle.LOB): value = value.read() if value else None
                result[col_name] = value
            logger.debug("INSERT with RETURNING executed successfully.")
            return ensure_serializable(result)
        else:
            cursor.execute(sql, params)
            affected_rows = cursor.rowcount
            connection.commit()
            logger.debug(f"INSERT executed successfully. Affected rows: {affected_rows}")
            return affected_rows
            
    except cx_Oracle.Error as db_err:
        error_obj, = db_err.args
        logger.error(f"Oracle DB Error during INSERT:")
        logger.error(f"  Code: {error_obj.code}, Message: {error_obj.message}, Context: {error_obj.context}")
        logger.error(f"  Query: {sql[:500]}...")
        logger.error(f"  Params: {params}")
        if connection: connection.rollback()
        return None if return_inserted else 0
    except Exception as e:
        logger.error(f"Unexpected error during INSERT execution: {str(e)}", exc_info=True)
        if connection: connection.rollback()
        return None if return_inserted else 0
    finally:
        if cursor: cursor.close()
        if connection:
             try:
                 if connection_pool: connection_pool.release(connection)
                 else: connection.close()
                 logger.debug("DB connection released/closed after INSERT.")
             except Exception as release_err:
                 logger.error(f"Connection release/close failed (INSERT): {release_err}")

def execute_delete(sql: str, params: Dict[str, Any]) -> int:
    """DELETE 쿼리를 실행하고 영향받은 행의 수를 반환합니다."""
    # execute_update와 로직이 동일하므로, 강화된 execute_update 호출
    logger.debug(f"Executing DELETE (via execute_update): Query='{sql[:100]}...', Params={params}")
    return execute_update(sql, params)

def can_connect_to_db() -> bool:
    """데이터베이스에 연결 가능한지 확인합니다."""
    try:
        connection = get_db_connection()
        with get_cursor(connection, should_commit=False) as cursor:
            cursor.execute("SELECT 1 FROM DUAL")
            result = cursor.fetchone()
            if result and result[0] == 1:
                logger.info("Oracle 데이터베이스 연결 성공")
                return True
            return False
    except Exception as e:
        logger.error(f"Oracle 데이터베이스 연결 확인 실패: {str(e)}")
        return False
    finally:
        if connection:
            try:
                connection_pool.release(connection)
            except Exception:
                pass

try:
    init_connection_pool()
except Exception as e:
    logger.error(f"초기 Oracle 연결 풀 생성 실패: {str(e)}") 