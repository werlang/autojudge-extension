const input = require('fs').readFileSync(0, 'utf8').split('\n');

const a = parseInt(input.shift());
const b = parseInt(input.shift());

console.log(`X = ${a + b}`);
