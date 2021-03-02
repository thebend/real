import {
	Button,
	ButtonGroup,
	Drawer,
	FormControlLabel,
	Icon,
	Input,
	MenuItem,
	Paper,
	Select,
	Switch,
	TextField,
} from "@material-ui/core"
import { Search } from "@material-ui/icons"
import React, { useState } from "react"
import { LandProperty } from "./LandProperty"
import { Tooltip } from "./Tooltip"

const labels = {
	age: "Building Age",
	vLand: "Land $",
	vTotal: "Total $",
	vBuilding: "Building $",
	// land_change: "Δ Land $",
	// building_change: "Δ Building $",
	// total_change: "Δ Total $",
	bedrooms: "# Bedrooms",
	bathrooms: "# Bathrooms",
	zone: "Zoning",
}
type Choice = keyof typeof labels
const choices = ["age", "vTotal", "vLand", "vBuilding", "bedrooms", "bathrooms", "zoning"] as Choice[]

type Props = {
	hoverProperty?: LandProperty
}
export const Sidebar = ({ hoverProperty }: Props) => {
	const [val, setVal] = useState<Choice>("age")
	return (
		<Drawer variant="permanent" anchor="left">
			{/* Add icon to search based on number of results found */}
			{/* don't forget to standardize case in filter comparison */}
			{/* debounce search */}
			<Search />
			<Icon>
				<Search />
			</Icon>
			<Input type="text" name="search" itemType="search" placeholder="Address Search" />
			<TextField type="text" name="search" itemType="search" placeholder="Address Search" />

			<ButtonGroup variant="contained">
				<Button>Logarithmic</Button>
				<Button>Linear</Button>
			</ButtonGroup>
			<ButtonGroup variant="contained">
				<Button>Zone Colors</Button>
				<Button>Value Scale</Button>
			</ButtonGroup>
			<FormControlLabel control={<Switch checked name="residential" />} label="Residential Only?" />
			<Select value={val} onChange={e => setVal(e.target.value as Choice)}>
				{choices.map(k => (
					<MenuItem key={k} value={k}>
						{labels[k]}
					</MenuItem>
				))}
			</Select>
			<Paper style={{ width: "20em", overflow: "hidden" }}>
				{hoverProperty && <Tooltip property={hoverProperty} />}
			</Paper>
		</Drawer>
	)
}
