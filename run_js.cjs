const fs = require('fs');
const html = fs.readFileSync('public/7inch-launcher.html', 'utf8');
const jsCode = html.match(/<script>(.*)<\/script>/s)[1];

// Mock DOM
global.document = {
    getElementById: (id) => {
        if (id === 'trend-temp' || id === 'trend-sg') return null; // We know these are missing
        return { style: {}, innerText: '', classList: { toggle: () => {} }, setAttribute: () => {} };
    },
    querySelector: () => ({ style: {} }),
    querySelectorAll: () => ([]),
};
global.window = { addEventListener: () => {} };
global.setInterval = (fn, ms) => { 
    try { fn(); } catch(e) { console.error("Interval error:", e.message); } 
};
global.setTimeout = (fn, ms) => { fn(); };

try {
    eval(jsCode);
    console.log("JS executed successfully.");
} catch(e) {
    console.error("JS Error:", e.message);
}
