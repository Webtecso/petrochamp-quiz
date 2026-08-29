"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startConfigSync = void 0;
const socket_1 = require("./socket");
const teams_1 = require("../stores/teams");
const quizContent_1 = require("../stores/quizContent");
const tiebreakQuestions_1 = require("../stores/tiebreakQuestions");
const phases_1 = require("../stores/phases");
const campeonato_1 = require("../stores/campeonato");
let listening = false;
function startConfigSync() {
    if (listening)
        return;
    listening = true;
    (0, socket_1.getSocket)().on('config:updated', async (payload) => {
        const campeonatoStore = (0, campeonato_1.useCampeonatoStore)();
        const championship = payload.championship ?? campeonatoStore.championship ?? undefined;
        switch (payload.type) {
            case 'teams':
                await (0, teams_1.useTeamsStore)().fetchTeams();
                break;
            case 'questions':
                await (0, quizContent_1.useQuizContentStore)().fetchQuestions(championship);
                break;
            case 'evaluationItems':
                await (0, quizContent_1.useQuizContentStore)().fetchEvaluationItems(championship);
                break;
            case 'tiebreakQuestions':
                await (0, tiebreakQuestions_1.useTiebreakQuestionsStore)().fetchQuestions(championship);
                break;
            case 'phases':
                await (0, phases_1.usePhasesStore)().fetchPhases(championship);
                break;
            // jurors, partners, suspensePhrases, presentation: os ecrãs que usam
            // esses dados hoje buscam-nos diretamente via fetch() local (não têm
            // store dedicado com action de refetch) - nada a fazer aqui por agora.
        }
    });
}
exports.startConfigSync = startConfigSync;
//# sourceMappingURL=configSync.js.map