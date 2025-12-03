import os
import oracledb
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point

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

def sql_to_gdf(name):

    cursor = get_connection().cursor()

    # Load sites from Oracle database
    cursor.execute(f'select * from s1511340.{name}')
    rows = cursor.fetchall()

    # Get column names from cursor description
    columns = [desc[0] for desc in cursor.description]

    #create gdf
    df = pd.DataFrame(rows, columns = columns)
    geometry = [Point(xy) for xy in zip(df['XCOORD'], df['YCOORD'])]
    gdf = gpd.GeoDataFrame(df, geometry = geometry, crs = 'EPSG:27700')
    
    return gdf