const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync("public/7inch-launcher.html", "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously" });

console.log("JSDOM initialized without fatal parse errors.");
if (dom.window.document.getElementById('launcher-ui')) {
    console.log("launcher-ui found");
} else {
    console.log("launcher-ui missing");
}
