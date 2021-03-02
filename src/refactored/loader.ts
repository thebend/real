import axios from "axios"
import { csvParse, DSVRowString } from "d3-dsv"
import { LandProperty, LandSale } from "./LandProperty"
import { zones } from "./Zone"
import proj4 from "proj4"
import { area, polygon } from "@turf/turf"

export const epsg26909 = "+proj=utm +zone=9 +ellps=GRS80 +datum=NAD83 +units=m +no_defs"
export const epsg3857 =
	"+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs"

export const convertFromEpsg26909 = proj4(epsg26909, "EPSG:4326").forward
export const convertFromEpsg3857 = proj4(epsg3857, "EPSG:4326").forward
export const convertFromCompressedAssessment = (coords: [number, number][]) =>
	coords.map(([lng, lat]) => convertFromEpsg3857([lng / 100, lat / 100]) as [number, number])

export const cleanLandPropertyRow = (r: DSVRowString<string>) => {
	const points = convertFromCompressedAssessment(JSON.parse(r.geometry!))
	const bedrooms = +r.bedrooms!
	const bathrooms = +r.bathrooms!
	const zoning = r.zoning!
	const d: LandProperty = {
		id: r.oid_evbc_b64!,
		oidEvbcB64: r.oid_evbc_b64!,
		pid: r.pid!,
		vLand: +r.total_assessed_land!,
		vBuilding: +r.total_assessed_building!,
		vTotal: +r.total_assessed_value!,
		pLand: +r.previous_land!,
		pBuilding: +r.previous_building!,
		pTotal: +r.previous_total!,

		yearBuilt: +r.year_built!,
		address: r.address!,

		salesHistory: JSON.parse(r.sales_history!) as LandSale[],
		points,
		area: area(polygon([points])),
		standardResidence: !!(bedrooms && bathrooms),
		zoning,
		zone: zones.find(z => z.codes.includes(zoning)),

		bedrooms,
		bathrooms,
		carport: !!+r.carport!,
		garage: !!+r.garage!,
		storeys: +r.storeys!,
	}
	return d
}

export const load = async () => {
	const response = await axios.get("/data/terrace.csv")
	return csvParse(response.data).map(cleanLandPropertyRow)
}
