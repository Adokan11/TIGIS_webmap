import flask
import pandas as pd
import geopandas as gpd
import pathlib
import dotenv
import db

dotenv.load_dotenv()  # only in development

app = flask.Flask(__name__)

DATA_DIR = pathlib.Path('data')

# load every geo file up front
datasets = {
    'buffers': gpd.read_file(DATA_DIR / 'Buffers.geojson'),
    'spaces' : gpd.read_file(DATA_DIR / 'Open_Spaces.geojson'),
    'sites' : db.sql_to_gdf('sites'),
    'ccs' : db.sql_to_gdf('community_centres')
}

# Process each dataset
for name, gdf in datasets.items():
    gdf = gdf.to_crs(epsg = 4326)

    # Convert date columns to strings for JSON serialization
    for col in gdf.columns:
        if pd.api.types.is_datetime64_any_dtype(gdf[col]):
            gdf[col] = gdf[col].dt.strftime('%Y-%m-%d')

    datasets[name] = gdf
print(f'Loaded {len(datasets["sites"])} sites with {len(datasets["buffers"])} buffer zones, ' + 
      str(len(datasets["spaces"])) + f' open spaces, and {len(datasets["ccs"])} community centres.')

@app.route('/layer/<layer_name>')
def get_layer(layer_name):
    
    if layer_name not in datasets:
        return flask.jsonify({'error': 'Layer not found'}), 404

    layer_gdf = datasets[layer_name]

    # Return GeoDataFrame as GeoJSON
    return flask.Response(layer_gdf.to_json(), mimetype = 'application/geo+json')

@app.route('/site_details/<des_ref>')
def get_site_details(des_ref):
    details = db.get_site_details(des_ref)
    return details

@app.route('/')
def index():
    layer_order = ['sites', 'buffers', 'spaces', 'ccs']
    return flask.render_template('index.html', layers = layer_order)

#debug
#get_site_details('LB47863')
#for i in datasets['sites']['DES_REF']:
#    get_site_details(i)
#print(datasets['spaces'].iloc[0])

if __name__ == '__main__':
    app.run(debug = True, port = 5000)
    # should be on http://127.0.0.1:5000
