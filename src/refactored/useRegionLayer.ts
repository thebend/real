import { SolidPolygonLayer } from "deck.gl"
import { Dispatch, SetStateAction, useMemo } from "react"
import { LandProperty } from "./LandProperty"

export const useRegionLayer = (
	data: LandProperty[] | undefined,
	setHoverElement: Dispatch<SetStateAction<LandProperty | undefined>>
) => {
	return useMemo(() => {
		return new SolidPolygonLayer<LandProperty>({
			id: "Properties",
			data,
			getPolygon: x => x.points,
			// getFillColor: x => (x.zone?.color ? [...x.zone.color, x.zone.type === "residential" ? 255 : 60] : [0, 0, 0]),
			getFillColor: x => (x.zone?.color ? [...x.zone.color, x.standardResidence ? 255 : 90] : [0, 0, 0]),
			getElevation: x =>
				// x.zone?.type === "residential" && x.bedrooms && x.bathrooms && x.area && x.area < 2500
				x.standardResidence ? Math.max(0, (x.vTotal - 300_000) / 1000) : 0, //x.bedrooms * 100,
			extruded: true,
			onHover: x => setHoverElement(x.object),
			pickable: true,
			autoHighlight: true,
		})
	}, [data, setHoverElement])
}
