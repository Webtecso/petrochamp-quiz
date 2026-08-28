"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./src/db");
async function main() {
    await db_1.prisma.question.deleteMany();
    await db_1.prisma.tiebreakQuestion.deleteMany();
    await db_1.prisma.phase.deleteMany();
    console.log('Perguntas, perguntas de desempate e fases limpas.');
}
main().then(() => process.exit(0));
//# sourceMappingURL=clear-scoped-data.js.map