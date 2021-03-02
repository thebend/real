import { useMemo, useState } from "react"
import MapGL, { ViewportProps } from "react-map-gl"
import { DeckGL } from "deck.gl"
import { Sidebar } from "./refactored/Sidebar"
import { useData } from "./useData"
import { LandProperty } from "./refactored/LandProperty"
import { useRegionLayer } from "./refactored/useRegionLayer"
import "mapbox-gl/dist/mapbox-gl.css"
import { addElevation } from "./refactored/addElevation"

export const App = () => {
	const data = useData()
	const [hoverElement, setHoverElement] = useState<LandProperty>()
	const [viewport, setViewport] = useState<ViewportProps>({ latitude: 54.52, longitude: -128.6, zoom: 13 })
	const regionLayer = useRegionLayer(data, setHoverElement)
	const layers = useMemo(() => [regionLayer], [regionLayer])
	return (
		<div>
			<section id="map">
				<MapGL
					{...viewport}
					onViewportChange={setViewport}
					width="100vw"
					height="100vh"
					onLoad={({ target: map }: any) => addElevation(map)}
				>
					<DeckGL initialViewState={viewport} layers={layers} />
				</MapGL>
			</section>
			<section id="histogram"></section>
			{data?.length && <Sidebar hoverProperty={hoverElement} />}
		</div>
	)
}
