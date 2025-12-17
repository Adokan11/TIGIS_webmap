# # TIGIS_webmap

This is the code base for the University of Edinburgh 2025 Capitol Greenspace Group 5's Web Map Experience. The primary objective of the web map is to serve as a visualisation and exploration tool for the final output of the Analytic Hierarchy Process (AHP) model, which ranked 65 Category C-listed buildings for potential retrofitting into new community centres in Edinburgh. Designed for government and council stakeholders and decision-makers, this web map allows users to dynamically view final site scores and explore the influence of four ranking criteria: Deprivation, Accessibility, Greenspace Type, and Proximity to Nearest Existing Community Centres. 

The web map was built using an open-source technical stack, leveraging Python for backend data handling and JavaScript for the interactive frontend interface.

---------

# # # Note
To run the development version of this website, you need be connected to the University of Edinburgh remote desktop, and have been granted access to the relevant SQL data tables. Assuming this is true, complete the following steps to run the development version of the webapp:

1. Ensure that you have downloaded `flask`, `geopandas`, `dotenv`, `oracledb`, and `pathlib` and all their dependencies.
2. To connect the SQL data tables, create a .env file in the following format
    * ORACLE_USER=s1234567
    * ORACLE_PASSWORD=***
Then include the resulting path in ``dotenv.load_dotenv()`` in [app.py](app.py).
3. Run [app.py](app.py) and then open http://127.0.0.1:5005