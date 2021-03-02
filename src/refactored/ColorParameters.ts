export type Shape = {
	id: string
	points: [number, number][]
}

export type ColorParameters<T extends Shape> = {
	accessor?: (d: T) => number | null
	colorRange?: string[]
	scale?: string
	viridis?: boolean
}
