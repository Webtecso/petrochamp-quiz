"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./src/db");
async function main() {
    const jurors = await db_1.prisma.juror.findMany({
        orderBy: { name: 'asc' }
    });
    console.log(JSON.stringify(jurors, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=checkJurors.js.map