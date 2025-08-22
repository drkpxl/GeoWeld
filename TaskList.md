## Task Web

Can we setup a very basic Node Web Interface that allows the following:

1. Uploading of boundaries.geojson ensuring the file name is fits our scripts convention
2. Creation of proper resort for the boundary, asking the user to name the resort
3. Editing of the name (for proper foldering) and tree_config options from the yaml.
4. Run the processing script
5. ONLY IF EASY, preview the geojson on map. I can provide a mapbox key.
6. Listing of ALL finished compiled files with the ability to download one at a time.

The ideal experience is we have this up and running and a user can upload their file and easily navigate the steps needed to download the combined files, handling as much as we can without there involvement.

While this should be basic lets use a nice design framework like shadcn. No need for rich templates as this can all happen in a single page experience.
