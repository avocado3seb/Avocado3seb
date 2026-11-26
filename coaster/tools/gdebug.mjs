import { genLayout } from '../src/gen.js';
import { buildDatabase } from '../src/data/index.js';
const db = buildDatabase(); const c = db.coasters.find(x => x.name === process.argv[2]);
console.log(genLayout(c));
