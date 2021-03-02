import { theme } from "./theme"
import { Shape } from "./ColorParameters"
import { Zone } from "./Zone"

export type LandSale = {
	date: string
	price: number
}
export type LandProperty = Shape & {
	id: string
	oidEvbcB64: string

	vTotal: number
	vBuilding: number
	vLand: number

	pTotal: number
	pLand: number
	pBuilding: number

	yearBuilt: number
	address: string

	points: [number, number][]
	area: number

	bedrooms: number
	bathrooms: number
	carport: boolean
	garage: boolean
	storeys: number
	salesHistory: LandSale[]

	zoning: string
	zone?: Zone

	standardResidence: boolean

	pid: string
}

const currentYear = new Date().getFullYear()
export const getAge = (d: LandProperty) => (d.yearBuilt ? currentYear - d.yearBuilt : null)

export const getZoneColor = ({ zone }: LandProperty) => zone?.color ?? theme.gray

// 60.3-60.5m areas are just placeholders with no accurate size
export const getLandValueDensity = ({ area, vLand }: LandProperty) => (area >= 60 && area <= 61 ? null : vLand / area)

export function getChangeRatio(current: number, previous: number) {
	if (current && previous) {
		const ratio = current / previous
		// use clamping here?
		// deal with outliers better than this!
		if (ratio > 0.5 && ratio < 2.5) return ratio
	}
	return 1
}
