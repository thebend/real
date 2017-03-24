interface Zone {
    type: string;
    codes: string[];
    color: string;
}

interface Shape {
    id: any;
    points: [number, number][];
}
interface ColorParameters {
    accessor?: (d: Shape) => number,
    colorRange?: string[],
    scale?: string,
    viridis?: boolean
}

var zones: Zone[] = [
    {
        "type": "residential",
        "codes": ['R1', 'R1-A', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'RS1'],
        "color": "green"
    }, {
        "type": "agricultural",
        "codes": ['AR1', 'AR2'],
        "color": "darkred",
    }, {
        "type": "commercial",
        "codes": ['C1', 'C1-A', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'ASC', 'GSC'],
        "color": "royalblue"
    }, {
        "type": "industrial",
        "codes": ['M1', 'M2', 'M3'],
        "color": "orange"
    }, {
        "type": "public",
        "codes": ['AO', 'P1', 'P2', 'P3'],
        "color": "slategrey"
    }
];
var color: any = {
    gray: 'rgb(191,191,191)',
    lightgray: 'rgb(211,211,211)',
    green: 'rgb(0,191,0)',
    red: 'rgb(191,0,0)'
}
color.goodBad = [color.green, color.gray];
color.badGood = [color.gray, color.green];
color.posNeg = [color.red, color.gray, color.green];

class Domain {
    x: [number, number];
    y: [number, number];
    
    constructor(x: [number, number], y: [number, number]) {
        this.x = d3.extent(x);
        this.y = d3.extent(y);
    }

    static scaleSide(side: [number, number], difference: number) {
        difference /= 2;
        side[0] -= difference;
        side[1] += difference;
    }
    scaleToRatio(targetRatio: number) {
        var width = this.x[1] - this.x[0];
        var height = this.y[1] - this.y[0];
        var thisRatio = height / width;
        if (thisRatio > targetRatio) { // this is too tall, must widen
            Domain.scaleSide(this.x, height / targetRatio - width);
        } else { // this is too wide, must heighten
            Domain.scaleSide(this.y, width * targetRatio - height);
        }
    }
}
