## Task 2

Rather than having to manually fetch the OSM data from the Overpass Turbo website it would be good to look at the boundary Geojson and programmatic fetch that data. Adjusting the workflow so that the python scripts at run time just looks for all entries in the yaml, usings the boundary geojson to fetch overpass data, downloads that data in the resort's data folder, and then runs the output script combining that data. The current and success query I am using to fetch forests and rocks is:

```sql
[out:json][timeout:60];
(
  // Forested areas
  way["landuse"="forest"]({{bbox}});
  way["natural"="wood"]({{bbox}});
  relation["landuse"="forest"]["type"="multipolygon"]({{bbox}});
  relation["natural"="wood"]["type"="multipolygon"]({{bbox}});
) -> .forest;
(
  // Rock features and formations
  way["natural"="rock"]({{bbox}});
  way["natural"="cliff"]({{bbox}});
  way["natural"="scree"]({{bbox}});
  way["natural"="bare_rock"]({{bbox}});
  way["natural"="stone"]({{bbox}});
  way["landuse"="quarry"]({{bbox}});
  relation["natural"="rock"]["type"="multipolygon"]({{bbox}});
  relation["natural"="cliff"]["type"="multipolygon"]({{bbox}});
  relation["natural"="scree"]["type"="multipolygon"]({{bbox}});
  relation["natural"="bare_rock"]["type"="multipolygon"]({{bbox}});
  relation["natural"="stone"]["type"="multipolygon"]({{bbox}});
  relation["landuse"="quarry"]["type"="multipolygon"]({{bbox}});
) -> .rocks;
(
  .forest;
  .rocks;
);
out body;
>;
out skel qt;
```

## Task 3 (not ready to start)

Rather the currently using the resort boundary, use a new feature boundary as the main polygon that should contain trees/rocks/etc. The go is a bit richer tree cover that extends beyond resort boundaries but not including the entire national forest. Our existing solution works well, so this is just swapping to a different boundary polygon.
