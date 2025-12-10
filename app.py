import flask
import pandas as pd
import geopandas as gpd
import pathlib
import dotenv
import json
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

# cc proximity for filters
proximity_df = db.sql_to_gdf('proximity')
datasets['sites'] = pd.concat([datasets['sites'], proximity_df['DISTANCE_M']], axis = 1)

# Process each dataset
for name, gdf in datasets.items():
    gdf = gdf.to_crs(epsg = 4326)

    # Convert date columns to strings for JSON serialization
    for col in gdf.columns:
        if pd.api.types.is_datetime64_any_dtype(gdf[col]):
            gdf[col] = gdf[col].dt.strftime('%Y-%m-%d')

    datasets[name] = gdf

# Only use some of the green spaces
space_types = sorted(datasets['spaces']['PAN65'].dropna().unique().tolist())
good_space_types = ['Cemetery', 'Churchyards', 'Civic space', 'Green Corridors', 'Institutions', 
    'Other semi-natural greenspace', 'Public Parks & Gardens', 'Residential', 'Semi-natural Park']
max_len = datasets['spaces'].shape[0]
datasets['spaces'] = datasets['spaces'][datasets['spaces']['PAN65'].isin(good_space_types)]
new_len = datasets['spaces'].shape[0]

print(f'Loaded {len(datasets["sites"])} sites with {len(datasets["buffers"])} buffer zones, ' + 
    f'{str(new_len)}/{str(max_len)} green spaces with '
    f'{len(good_space_types)}/{len(space_types)} classifications, and {len(datasets["ccs"])} community centres.')

# Load plasma colormap at startup
with open(DATA_DIR / 'plasma.dat', 'r') as f:
    plasma_data = json.load(f)

@app.route('/plasma')
def get_plasma():
    return json.dumps(plasma_data)

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
def home():
    # new landing page
    return flask.render_template('home.html')


@app.route('/map')
def map_view():
    # your existing webmap view
    layer_order = ['sites', 'buffers', 'spaces', 'ccs']
    return flask.render_template('index.html', layers=layer_order, space_types=good_space_types)


@app.route("/info_overview")
def info_overview():
    return flask.render_template("info_overview.html")



#debug
#get_site_details('LB47863')
#for i in datasets['sites']['DES_REF']:
#    get_site_details(i)
#print(datasets['spaces'].iloc[0])

if __name__ == '__main__':
    app.run(debug = True, port = 5005)
    # should be on http://127.0.0.1:5005