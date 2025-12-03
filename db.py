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

    conn = get_connection()
    cursor = conn.cursor()

    # Load sites from Oracle database
    cursor.execute(f'select * from s1511340.{name}')
    rows = cursor.fetchall()

    # Get column names from cursor description
    columns = [desc[0] for desc in cursor.description]

    #create gdf
    df = pd.DataFrame(rows, columns = columns)
    geometry = [Point(xy) for xy in zip(df['XCOORD'], df['YCOORD'])]
    gdf = gpd.GeoDataFrame(df, geometry = geometry, crs = 'EPSG:27700')
    
    conn.close()
    
    return gdf

def _sql_querry(cursor, table, idname, c_id):
    
    try:
        cursor.execute(f'select * from s1511340.{table} where {idname} = :id', [c_id])
    except Exception as e:
        raise ValueError({'error': f'{table} not found'}, 404) from e
    
    row = cursor.fetchone()
    if not row:
        return None
    columns = [desc[0] for desc in cursor.description]
    details = dict(zip(columns, row))
    #print(details)
    
    return details

def get_site_details(des_ref):
    
    conn = get_connection()
    cursor = conn.cursor()
    
    all_details = {}
    
    all_details['site_catchment'] = _sql_querry(cursor, 'site_catchment', 'DES_REF', des_ref)
    
    catchment_id = all_details['site_catchment']['CATCHMENT_ID']
    
    all_details['simd_score'] = _sql_querry(cursor, 'simd_score', 'CATCHMENT_ID', catchment_id)
    
    closest_os_id = _sql_querry(cursor, 'sites', 'DES_REF', des_ref)['CLOSEST_OS_ID']
    
    all_details['open_spaces'] = _sql_querry(cursor, 'open_spaces', 'OS_ID', int(closest_os_id))
    
    closest_centre_id = _sql_querry(cursor, 'proximity', 'DES_REF', des_ref)['CENTRE_ID']
    
    all_details['community_centres'] = _sql_querry(cursor, 'community_centres', 'CENTRE_ID', int(closest_centre_id))
    
    print(all_details)
    
    conn.close()
    
    return all_details
