const EvolutionSystem = {
    check(digimon) {
        const paths = EVOLUTION_TREE[digimon.id];
        if (!paths) return;

        for (const path of paths) {
            if (this.meetsConditions(digimon, path.conditions)) {
                game.pendingEvolutions.push({ digimon, fromId: digimon.id, toId: path.to });
                return;
            }
        }
    },

    meetsConditions(digimon, conditions) {
        if (conditions.minTicks && digimon.levelTicks < conditions.minTicks) return false;
        if (conditions.age      && digimon.age        < conditions.age)      return false;
        if (conditions.battles  && (digimon.wins + digimon.losses) < conditions.battles) return false;
        if (conditions.defeats  && digimon.losses      < conditions.defeats)  return false;
        return true;
    },
};
