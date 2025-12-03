import flask
import geopandas as gpd
import pathlib
import dotenv
from db import get_connection

dotenv.load_dotenv()  # only in development

conn = get_connection()
cursor = conn.cursor()
cursor.execute('select * from s1511340.sites')

app = flask.Flask(__name__)

DATA_DIR = pathlib.Path('data')

datasets = {
    'buffers': gpd.read_file(DATA_DIR / 'Buffers.geojson'),
    'spaces' : gpd.read_file(DATA_DIR / 'Open_Spaces.geojson')}

# Process each dataset
for name, gdf in datasets.items():
    gdf = gdf.to_crs(epsg = 4326)

    # Convert date columns to strings for JSON serialization
    if name == 'buffers':
        gdf['CREATED'] = gdf['CREATED'].dt.strftime('%Y-%m-%d')
        gdf['UPDATED'] = gdf['UPDATED'].dt.strftime('%Y-%m-%d')
        gdf['DESIGNATED'] = gdf['DESIGNATED'].dt.strftime('%Y-%m-%d')
        gdf['AMENDED'] = gdf['AMENDED'].dt.strftime('%Y-%m-%d')

    datasets[name] = gdf
print(f'Loaded {len(datasets["buffers"])} buffer zones and {len(datasets["spaces"])} open spaces')

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