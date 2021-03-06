import { center, polygon } from "@turf/turf"
import { HeatmapLayer, Position, Position2D, SolidPolygonLayer } from "deck.gl"
import { Dispatch, SetStateAction, useMemo } from "react"
import { LandProperty } from "./LandProperty"

export const useRegionLayer = (
	data: LandProperty[] | undefined,
	setHoverElement: Dispatch<SetStateAction<LandProperty | undefined>>,
	heatmap = true
) => {
	return useMemo(() => {
		if (heatmap)
			return new HeatmapLayer<LandProperty>({
				id: "Properties-hm",
				data,
				getPosition: x => {
					const c = center(polygon([x.points])).geometry.coordinates as Position2D
					console.log(c)
					return c
				},
				getWeight: ({ area, vTotal, ...x }) =>
					x.standardResidence && area > 800 ? (vTotal / area) ** 2 / 1000 : 0,
			})
		return new SolidPolygonLayer<LandProperty>({
			id: "Properties-poly",
			data,
			getPolygon: x => x.points,
			// getFillColor: x => (x.zone?.color ? [...x.zone.color, x.zone.type === "residential" ? 255 : 60] : [0, 0, 0]),
			getFillColor: x => (x.zone?.color ? [...x.zone.color, x.standardResidence ? 255 : 90] : [0, 0, 0]),
			getElevation: x =>
				// x.zone?.type === "residential" && x.bedrooms && x.bathrooms && x.area && x.area < 2500
				// x.standardResidence ? Math.max(0, (x.vTotal - 300_000) / 1000) : 0, //x.bedrooms * 100,
				x.standardResidence && x.area > 800 ? (x.vTotal / x.area) ** 2 / 1000 : 0, //x.bedrooms * 100,
			extruded: true,
			onHover: x => setHoverElement(x.object),
			pickable: true,
			autoHighlight: true,
		})
	}, [data, heatmap, setHoverElement])
}
