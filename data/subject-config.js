(function () {
    const SUBJECT_CONFIG = {
        BASES: {
            // aliases의 첫번째 과목명은 약칭 과목명로 사용할 '2글자'로 배치할 것.
            // grade는 해당 과목의 개설 학년임. ex) grades: [2]
            // level_grades 사용예시: 생명과학I은 2학년, 생명과학II는 3학년 과목인 경우, level_grades: { 'I': 2, 'II': 3 }
            '생명과학': { aliases: ['생명', 'Bio'], level_grades: { 'I': 2, 'II': 3 }, grades: [2] },
            '물리학': { aliases: ['물리', '물', 'Phys'], level_grades: { 'I': 2, 'II': 3 }, grades: [2] },
            '화학': { aliases: ['화학', '화', 'Chem'], level_grades: { 'I': 2, 'II': 3 }, grades: [2] },
            '지구과학': { aliases: ['지구', '지학', '지', 'Earth'], level_grades: { 'I': 2, 'II': 3 }, grades: [2] },
            '과학탐구실험': { aliases: ['과탐', '탐구', '실험', '과학탐구실험', '과탐실'], level_grades: { 'I': 1 }, grades: [1] },
            '융합과학': { aliases: ['융과', '융합', '융', '융합과학'], grades: [3] },
            '생활과 과학': { aliases: ['생과', '생활과 과학', '생활과과학'], grades: [3] },
            '통합과학': { aliases: ['통과', '통합', '통'], level_grades: { 'I': 1 }, grades: [1] },
            '지구시스템과학': { aliases: ['지시', '지구시스템'], grades: [2] },
            '역학과 에너지': { aliases: ['역학', '역에', '역학과에너지'], grades: [2] },
            '물질과 에너지': { aliases: ['물질', '물에', '물질과에너지'], grades: [2] },
            '세포와 물질대사': { aliases: ['세포', '세물', '세포와물질대사'], grades: [2] },
            '전자기와 양자': { aliases: ['전자', '전양', '전자기와양자'], grades: [3] },
            '화학반응의 세계': { aliases: ['화반', '화세', '반응', '화학반응의 세계'], grades: [3] },
            '생물의 유전': { aliases: ['유전', '생유', '생물의유전'], grades: [3] },
            '행성우주과학': { aliases: ['행성', '행우', '우주'], grades: [3] },
            '과학과제연구': { aliases: ['과연', '과제', '연구'], grades: [3] },
            '과학의 역사와 문화': { aliases: ['과역', '과문', '과학의역사와문화'], grades: [3] },
            '기후변화와 환경생태': { aliases: ['기후', '기환', '환경', '기후변화와환경생태'], grades: [3] },
            '융합과학탐구': { aliases: ['융탐', '융합과학 탐구'], grades: [3] }
        },
        LEVELS: {
            'I': ['1', 'I', 'Ⅰ', 'ⅰ', '１', 'i'],
            'II': ['2', 'II', 'Ⅱ', 'ⅱ', '２', 'ii']
        }
    };

    globalThis.App = globalThis.App || {};
    globalThis.App.SubjectConfig = SUBJECT_CONFIG;
})();
