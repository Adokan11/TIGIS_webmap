import flask
import pandas as pd
import geopandas as gpd
import pathlib
import dotenv
from shapely.geometry import Point
import db

dotenv.load_dotenv()  # only in development

cursor = db.get_connection().cursor()

app = flask.Flask(__name__)

DATA_DIR = pathlib.Path('data')

datasets = {
    'buffers': gpd.read_file(DATA_DIR / 'Buffers.geojson'),
    'spaces' : gpd.read_file(DATA_DIR / 'Open_Spaces.geojson')}

# Load sites from Oracle database
cursor.execute('select * from s1511340.sites')
rows = cursor.fetchall()

# Get column names from cursor description
columns = [desc[0] for desc in cursor.description]

#create gdf
df_sites = pd.DataFrame(rows, columns = columns)
geometry = [Point(xy) for xy in zip(df_sites['XCOORD'], df_sites['YCOORD'])]
gdf_sites = gpd.GeoDataFrame(df_sites, geometry = geometry, crs = 'EPSG:27700')

# Add to datasets
datasets['sites'] = gdf_sites

# Process each dataset
for name, gdf in datasets.items():
    gdf = gdf.to_crs(epsg = 4326)

    # Convert date columns to strings for JSON serialization
    for col in gdf.columns:
        if pd.api.types.is_datetime64_any_dtype(gdf[col]):
            gdf[col] = gdf[col].dt.strftime('%Y-%m-%d')

    datasets[name] = gdf
print(f'Loaded {len(datasets["buffers"])} buffer zones, ' + str(len(datasets["spaces"])) +
    f' open spaces, and {len(datasets["sites"])} sites')

@app.route('/layer/<layer_name>')
def get_layer(layer_name):
    
    if layer_name not in datasets:
        return flask.jsonify({'error': 'Layer not found'}), 404

    gdf = datasets[layer_name]

    # Return GeoDataFrame as GeoJSON
    return flask.Response(gdf.to_json(), mimetype = 'application/geo+json')

@app.route('/')
def index():
    return flask.render_template('index.html', layers = list(datasets.keys()))

if __name__ == '__main__':
    app.run(debug = True, port = 5000)
    # should be on http://127.0.0.1:5000