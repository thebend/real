import { scaleLinear, scaleLog, ScaleContinuousNumeric } from "d3-scale"
import { extent, max } from "d3-array"
import { interpolateViridis } from "d3-scale-chromatic"
import { interpolateRgbBasis } from "d3-interpolate"
import { format } from "d3-format"
import { theme } from "./refactored/theme"
import { ColorParameters, Shape } from "./refactored/ColorParameters"
import { useEffect, useMemo } from "react"

// const MIN_ZOOM_SIZE = 5
const DEFAULT_COLOR = "#444"
const HIGHLIGHT_COLOR = "white"
const BAR_THICKNESS = 6
const legendPrecision = format(".2s")

// filter is smart
// histogram is smart

export const useHistogramData = (orientation: string) => {
	const xScale = scaleLinear()
	const yScale = scaleLinear()
}

export const useColorScheme = <T extends Shape>(
	allRecords: T[],
	filter: (record: T) => boolean,
	accessor: (record: T) => number,
	dataScale: ScaleContinuousNumeric<number, number> = scaleLinear<number, number>(),
	colorInterpolator: (t: number) => string = interpolateRgbBasis([theme.gray, theme.green]),
	colorScale = scaleLinear<string, string>(),
	viridis = false
) => {
	const records = useMemo(() => allRecords.filter(filter), [allRecords, filter])
	const values = useMemo(() => records.map(accessor), [records, accessor])

	useEffect(() => {
		// should I specify domain or range?
		// somewhere need to set the other to the correct color extremes
		dataScale.domain(extent(values) as [number, number])
	}, [values, dataScale])

	useEffect(() => {
		colorScale.interpolate(() => (viridis ? interpolateViridis : colorInterpolator))
	}, [viridis, colorScale, colorInterpolator])

	const getColor = (d: T) => {
		var val = accessor(d)
		return val == null ? DEFAULT_COLOR : colorScale(dataScale(val))
	}

	const updateFocusedData = () => {
		const domain = extent(values) as [number, number]
		const multiRange = dataScale.range().length === 3
		dataScale.domain(multiRange ? [domain[0], 1, domain[1]] : domain)
	}
}
