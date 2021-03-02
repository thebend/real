import { useEffect, useState } from "react"
import { LandProperty } from "./refactored/LandProperty"
import { load } from "./refactored/loader"

export const useData = () => {
	const [data, setData] = useState<LandProperty[]>()
	useEffect(() => {
		load().then(setData)
	}, [])
	return data
}
