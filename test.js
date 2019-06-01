import { readFileSync } from 'fs';
import acorn from 'acorn';
import { inspect } from 'util';

let [, , ...args] = process.argv;

let script = readFileSync(args[0]);

console.log(inspect(acorn.parse(script), false, null, true));
