import { getAge, getChangeRatio, getLandValueDensity, getZoneColor, LandProperty } from "./refactored/LandProperty"
import { theme } from "./refactored/theme"

export const recolorActions = {
	"land-value": { accessor: getLandValueDensity, colorRange: theme.badGood, scale: "linear" },
	age: { accessor: getAge, colorRange: theme.goodBad, scale: "log" },
	"total-value": {
		accessor: (d: LandProperty) => d.vTotal,
		colorRange: theme.goodBad,
		scale: "log",
	},
	"change-building": {
		accessor: (d: LandProperty) => getChangeRatio(d.vBuilding, d.pBuilding),
		colorRange: theme.posNeg,
		scale: "log",
	},
	"change-land": {
		accessor: (d: LandProperty) => getChangeRatio(d.vLand, d.pLand),
		colorRange: theme.posNeg,
		scale: "linear",
	},
	"zone-type": getZoneColor,
	bedroom: { accessor: (d: LandProperty) => d.bedrooms, colorRange: theme.goodBad, scale: "log" },
	bathroom: { accessor: (d: LandProperty) => d.bathrooms, colorRange: theme.goodBad, scale: "log" },
}
