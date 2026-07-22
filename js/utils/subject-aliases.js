(function () {
    const config = globalThis.App?.SubjectConfig || { BASES: {}, LEVELS: {} };
    const SUBJECT_BASES = config.BASES;
    const LEVEL_MAP = config.LEVELS;

    const SUBJECT_ALIASES = {};

    // 1. Generate Base Aliases
    for (const [target, configObj] of Object.entries(SUBJECT_BASES)) {
        const aliases = configObj.aliases || [];
        aliases.forEach(alias => {
            SUBJECT_ALIASES[alias.replace(/\s+/g, '')] = target;
        });
    }

    // 2. Generate Combined Aliases (Base + Level)
    for (const [targetBase, configObj] of Object.entries(SUBJECT_BASES)) {
        const aliases = configObj.aliases || [];
        // Core sciences subjects usually get combined with levels
        const needsLevel = configObj.level_grades !== undefined;

        if (needsLevel) {
            for (const [levelTarget, levelAliases] of Object.entries(LEVEL_MAP)) {
                const targetFullName = targetBase + levelTarget;
                aliases.forEach(baseAlias => {
                    levelAliases.forEach(levelAlias => {
                        const combined = (baseAlias + levelAlias).replace(/\s+/g, '');
                        SUBJECT_ALIASES[combined] = targetFullName;
                    });
                });
            }
        }
    }

    /**
     * Normalizes a subject name using aliases and removing spaces.
     * @param {string} name 
     * @returns {string}
     */
    function normalizeSubject(name) {
        if (!name) return '';
        const norm = name.toString().trim().replace(/\s+/g, '');
        return SUBJECT_ALIASES[norm] || norm;
    }

    globalThis.App = globalThis.App || {};
    globalThis.App.SubjectAliases = SUBJECT_ALIASES;
    globalThis.App.normalizeSubject = normalizeSubject;
})();

