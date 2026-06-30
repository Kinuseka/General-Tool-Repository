const fs = require("fs");
const path = require("path");
const webpack = require("webpack");

module.exports = {
    mode: "development",
    devtool: "source-map",
    entry: "./src/GreasemonkeyScript/init.ts",
    output: {
        filename: "GreasemonkeyScript.user.js",
        path: path.resolve(__dirname, "dist")
    },
    resolve: {
        extensions: [".ts", ".js"]
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: "ts-loader",
                exclude: /node_modules/
            }
        ]
    },
    plugins: [
        new webpack.BannerPlugin({
            banner: fs.readFileSync("./src/GreasemonkeyScript/gm_front.txt", "utf-8"),
            raw: true
        })
    ]
};
