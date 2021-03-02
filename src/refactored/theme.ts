import { rgb } from "d3-color"

export const theme = {
	gray: [191, 191, 191],
	lightgray: [211, 211, 211],
	green: [0, 191, 0],
	red: [191, 0, 0],
} as Record<string, any>
theme.goodBad = [theme.green, theme.gray]
theme.badGood = [theme.gray, theme.green]
theme.posNeg = [theme.red, theme.gray, theme.green]

export const getColor = (colorString: string, overrideOpacity?: number) => {
	const { r, g, b, opacity } = rgb(colorString)
	return [r, g, b, overrideOpacity !== undefined ? overrideOpacity : opacity]
}
