import { LandProperty } from "./LandProperty"
import { format } from "d3-format"
import { ReactNode } from "react"

export const currencyFormat = format("$,")
export const yesNo = (d: boolean) => (d ? "Yes" : "No")

type UpDownProps = {
	heading: string
	v1: number
	v2: number
}
export function getGlyph(before: number, after: number) {
	return "glyphicon-arrow-" + (after - before > 0 ? "up" : "down")
}
const UpDown = ({ heading, v1, v2 }: UpDownProps) => (
	<tr>
		<th>{heading}</th>
		<td>
			{currencyFormat(v1)}
			<span style={{ marginLeft: "0.75em" }} className={`glyphicon ${getGlyph(v2, v1)}`}></span>
		</td>
		<td>{currencyFormat(v2)}</td>
	</tr>
)

type Props = {
	property: LandProperty
}
export const Tooltip = ({
	property: {
		address,
		pid,
		vBuilding,
		vLand,
		vTotal,
		pLand,
		pBuilding,
		pTotal,
		yearBuilt,
		zoning,
		garage,
		storeys,
		carport,
		bedrooms,
		bathrooms,
		area,
	},
}: Props) => {
	return (
		<>
			<h2 id="address">{address}</h2>
			<p id="pid">
				<strong>PID:</strong> {pid}
			</p>
			<table id="assessed-values">
				<thead>
					<tr>
						<th></th>
						<th>Current</th>
						<th>Previous</th>
					</tr>
				</thead>
				<tbody>
					<UpDown heading="Land" v1={vLand} v2={pLand} />
					<UpDown heading="Building" v1={vBuilding} v2={pBuilding} />
					<UpDown heading="Total" v1={vTotal} v2={pTotal} />
				</tbody>
			</table>
			<section id="details">
				<LabelVal label="Year Built" val={yearBuilt} />
				<LabelVal label="Zoning Built" val={zoning} />
				<LabelVal label="Bedrooms" val={bedrooms} />
				<LabelVal label="Bathrooms" val={bathrooms} />
				<LabelVal label="Carport" val={yesNo(carport)} />
				<LabelVal label="Garage" val={yesNo(garage)} />
				<LabelVal label="Storeys" val={storeys} />
				<LabelVal
					label="Area"
					val={
						<>
							{area} m<sup>2</sup>
						</>
					}
				/>
			</section>
		</>
	)
}

const LabelVal = ({ label, val }: { label: string; val: ReactNode }) => (
	<p>
		<strong>{label}:</strong> {val}
	</p>
)
