import os
import oracledb

def get_connection():

    if not os.getenv("ORACLE_USER"):
        raise RuntimeError("ORACLE_USER not set in .env")
    if not os.getenv("ORACLE_PASSWORD"):
        raise RuntimeError("ORACLE_PASSWORD not set in .env")
    
    ORACLE_USER = os.getenv("ORACLE_USER")
    ORACLE_PASSWORD = os.getenv("ORACLE_PASSWORD")
    ORACLE_HOST = 'ora-geoslrn-kb1live.is.ed.ac.uk'
    ORACLE_PORT = '1842'
    ORACLE_SERVICE = 'GLRNLIVE_PRMY.is.ed.ac.uk'

    return oracledb.connect(
        user = ORACLE_USER,
        password = ORACLE_PASSWORD,
        host = ORACLE_HOST,
        port = ORACLE_PORT,
        service_name = ORACLE_SERVICE,
    )
