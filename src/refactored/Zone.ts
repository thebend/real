export type Zone = {
	type: string
	codes: string[]
	color: [number, number, number]
}

export const zones: Zone[] = [
	{
		type: "residential",
		codes: ["R1", "R1-A", "R2", "R3", "R4", "R5", "R6", "R7", "RS1"],
		color: [0, 191, 0],
	},
	{
		type: "agricultural",
		codes: ["AR1", "AR2"],
		color: [64, 0, 0],
	},
	{
		type: "commercial",
		codes: ["C1", "C1-A", "C2", "C3", "C4", "C5", "C6", "C7", "ASC", "GSC"],
		color: [60, 70, 255],
	},
	{
		type: "industrial",
		codes: ["M1", "M2", "M3"],
		color: [255, 127, 0],
	},
	{
		type: "public",
		codes: ["AO", "P1", "P2", "P3"],
		color: [66, 80, 66],
	},
]
