// Usage: <MapGL onLoad={({ target: map }: any) => addTerrain(target)} />
export const addElevation = (map: any, exaggeration = 1) => {
	map.addSource("mapbox-dem", {
		type: "raster-dem",
		url: "mapbox://mapbox.mapbox-terrain-dem-v1",
		tileSize: 512,
		maxzoom: 14,
	})
	map.setTerrain({ source: "mapbox-dem", exaggeration })
}
