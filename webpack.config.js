module.exports = {
    context: __dirname + "/src",
    entry: "./map.ts",
    output: {
        path: __dirname + "/build",
        filename: "bundle.js"
    },
    module: {
        rules: [{
            test: /\.tsx?$/,
            loader: 'ts-loader'
        }]
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"]
    },
}
