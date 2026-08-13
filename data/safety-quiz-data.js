(function () {
    /**
     * [스마트 과학실 안전 퀴즈 고정 문항 풀]
     * 
     * 새로운 문제를 추가할 때는 아래 양식에 맞게 객체를 배열에 추가해주세요.
     * 기본 양식: { q: "질문", options: ["보기1", "보기2", "보기3", "보기4"], correct: 정답인덱스(0~3) }
     * 
     * [섹션 수동 지정 방법]
     * 기본적으로 시스템이 문항의 단어를 분석하여 적절한 섹션으로 자동 분류합니다.
     * 특정 섹션으로 100% 확실하게 지정하고 싶다면 아래와 같이 'section' 속성을 추가해 주세요.
         */
    const FIXED_POOL = [
        { q: "GHS01 그림문자가 의미하는 것은?", options: ["폭발성", "인화성", "산화성", "독성"], correct: 0, section: 4 },
        { q: "GHS02 그림문자가 의미하는 것은?", options: ["폭발성", "인화성", "산화성", "부식성"], correct: 1, section: 4 },
        { q: "GHS03 그림문자가 의미하는 것은?", options: ["인화성", "산화성", "고압가스", "부식성"], correct: 1, section: 4 },
        { q: "GHS04 그림문자가 의미하는 것은?", options: ["산화성", "고압가스", "부식성", "독성"], correct: 1, section: 4 },
        { q: "GHS05 그림문자가 의미하는 것은?", options: ["부식성", "독성", "감탄사", "건강유해성"], correct: 0, section: 4 },
        { q: "GHS06 그림문자가 의미하는 것은?", options: ["부식성", "급성 독성", "감탄사", "환경유해성"], correct: 1, section: 4 },
        { q: "GHS07 그림문자가 의미하는 것은?", options: ["독성", "피부 자극성/감탄사", "건강유해성", "환경유해성"], correct: 1, section: 4 },
        { q: "GHS08 그림문자가 의미하는 것은?", options: ["독성", "감탄사", "건강유해성(발암성 등)", "환경유해성"], correct: 2, section: 4 },
        { q: "GHS09 그림문자가 의미하는 것은?", options: ["건강유해성", "환경유해성", "물 보존성", "산소 부족"], correct: 1, section: 4 },
        { q: "인화성 액체를 보관할 때 가장 적절한 장소는?", options: ["직사광선이 드는 창가", "환기가 잘 되는 서늘한 곳", "가열 기구 바로 옆", "밀폐된 두꺼운 상자"], correct: 1, section: 2 },
        { q: "강산(Strong Acid)이 피부에 묻었을 때 가장 먼저 해야 할 조치는?", options: ["중화제를 바른다", "흐르는 물에 20분 이상 씻는다", "수건으로 닦아낸다", "비누로 문지른다"], correct: 1, section: 3 },
        { q: "눈에 화학물질이 들어갔을 때 안구 세척기를 사용하는 올바른 시간은?", options: ["1분 이내", "5분", "15분 이상", "마를 때까지"], correct: 2, section: 3 },
        { q: "유기 용제(에탄올, 아세톤 등) 사용 시 주의사항으로 틀린 것은?", options: ["환기를 충분히 한다", "화기 엄금", "증기를 직접 흡입하지 않는다", "밀폐된 공간에서 장시간 사용한다"], correct: 3, section: 2 },
        { q: "소화기 사용법 중 'PASS'의 'P'가 의미하는 것은?", options: ["Push (밀기)", "Pull (안전핀 뽑기)", "Point (조준)", "Press (누르기)"], correct: 1, section: 3 },
        { q: "실험실에서 반드시 착용해야 하는 기본 복장이 아닌 것은?", options: ["실험복", "보안경", "슬리퍼", "밀폐된 신발"], correct: 2, section: 1 },
        { q: "화학물질의 유해성 정보를 확인할 수 있는 가장 정확한 문서는?", options: ["교과서", "MSDS (물질안전보건자료)", "신문 기사", "백과사전"], correct: 1, section: 4 },
        { q: "폐액을 버릴 때 올바른 방법은?", options: ["싱크대에 바로 버린다", "성상별(산, 염기 등)로 구분하여 폐액통에 버린다", "모든 폐액을 한 통에 합친다", "일반 쓰레기통에 버린다"], correct: 1, section: 2 },
        { q: "실험실 내에서 음식물 섭취가 금지되는 이유는?", options: ["화학물질 오염 및 섭취 위험", "교실이 더러워져서", "음식 냄새가 독해서", "집중력이 떨어져서"], correct: 0, section: 1 },
        { q: "화학 사고 발생 시 신고 번호로 적절하지 않은 것은?", options: ["119 (소방서)", "112 (경찰서)", "100 (국어사전)", "학교 행정실"], correct: 2, section: 3 },
        { q: "사용이 끝난 가스버너의 안전 조치로 옳은 것은?", options: ["연료통을 그대로 둔다", "밸브를 잠그고 연료통을 분리한다", "불만 끄고 나간다", "뜨거울 때 바로 가방에 넣는다"], correct: 1, section: 3 },
        { q: "알칼리 금속(나트륨 등)을 보관하는 올바른 방법은?", options: ["물에 담가둔다", "공기 중에 둔다", "석유나 파라핀 오일에 담가둔다", "알코올에 넣어둔다"], correct: 2, section: 2 },
        { q: "보안경을 쓰는 주된 이유는 무엇인가?", options: ["시력 보호", "화학물질이 눈에 튀는 것 방지", "패션 아이템", "먼지 차단"], correct: 1, section: 1 },
        { q: "실험실 안전 수칙 중 '화기 엄금'이 필요한 물질은?", options: ["증류수", "염화나트륨", "에탄올", "이산화탄소"], correct: 2, section: 2 },
        { q: "MSDS의 구성 항목은 총 몇 개인가?", options: ["10개", "12개", "16개", "20개"], correct: 2, section: 4 },
        { q: "수은이 엎질러졌을 때 대처법으로 옳은 것은?", options: ["빗자루로 쓴다", "손으로 줍는다", "전용 흡착제나 황가루를 뿌리고 신고한다", "걸레로 닦는다"], correct: 2, section: 3 },
        { q: "실험 전 가장 먼저 확인해야 할 위치는?", options: ["매점 위치", "화장실 위치", "비상구 및 안전장비(소방시설) 위치", "도서관 위치"], correct: 2, section: 3 },
        { q: "화학물질 용기에 라벨을 붙이는 이유는?", options: ["예뻐서", "내용물을 식별하고 유의사항을 알기 위해", "선생님이 시켜서", "유통기한을 적기 위해"], correct: 1, section: 4 },
        { q: "흄 후드(Fume Hood)의 용도는?", options: ["음식 조리", "유독 가스 배출", "보관함", "손 씻기"], correct: 1, section: 2 },
        { q: "시약장 문을 항상 닫아두어야 하는 이유는?", options: ["전기 절약", "유출 사고 방지 및 냄새 확산 방지", "디자인 때문", "먼지 방지"], correct: 1, section: 2 },
        { q: "실험실 사고 시 가장 먼저 연락해야 할 사람은?", options: ["친구", "담당 선생님", "교장 선생님", "학부모"], correct: 1, section: 3 },
        { q: "산성 폐액통에 염기성 액체를 대량으로 섞으면?", options: ["아무 일 없다", "중화 반응에 의한 열과 가스가 발생할 수 있다", "양이나 농도에 관계없이 물이 되므로 안전하다.", "색만 변한다"], correct: 1, section: 2 },
        { q: "유리 기구가 깨졌을 때 조치법은?", options: ["손으로 줍는다", "담당 선생님께 보고하고 빗자루와 쓰레받기를 사용한다", "발로 치운다", "그냥 둔다"], correct: 1, section: 3 },
        { q: "머리카락이 긴 학생의 실험실 복장 수칙은?", options: ["그냥 둔다", "풀어헤친다", "뒤로 묶는다", "앞으로 내린다"], correct: 2, section: 1 },
        { q: "가열 중인 시험관의 입구 방향은?", options: ["자신을 향하게", "옆 친구를 향하게", "사람이 없는 방향을 향하게", "입구를 막는다"], correct: 2, section: 1 },
        { q: "전기 기구 사용 시 젖은 손으로 만지면 안 되는 이유는?", options: ["손이 미끄러워서", "감전의 위험이 커서", "기구가 고장 나서", "손자국이 남아서"], correct: 1, section: 1 },
        { q: "실험 후 남은 시약을 다시 시약병에 넣지 않는 이유는?", options: ["아까워서", "본래 시약의 오염 방지", "병이 작아서", "귀찮아서"], correct: 1, section: 2 },
        { q: "독성 물질을 취급할 때 착용해야 하는 장갑은?", options: ["면장갑", "니트릴 또는 화학용 고무장갑", "털장갑", "안 껴도 됨"], correct: 1, section: 1 },
        { q: "실험실 환풍기를 항상 가동해야 하는 이유는?", options: ["시원하게 하려고", "공기 중 유해 가스 농도를 낮추기 위해", "소음을 내기 위해", "전등을 켜기 위해"], correct: 1, section: 1 },
        { q: "비상 샤워기의 용도는?", options: ["더위 식히기", "몸 전체에 화학물질이 묻었을 때 대량의 물로 씻어내기", "청소용", "화단 물주기"], correct: 1, section: 3 },
        { q: "화학물질의 냄새를 맡는 올바른 방법은?", options: ["코를 대고 깊게 들이마신다", "손으로 바람을 일으켜 살짝 맡는다", "냄새를 맡지 않는다", "입으로 마신다"], correct: 1, section: 1 },
        { q: "실험 중 비커를 떨어뜨려 유리가 깨지고 약품이 쏟아졌을 때 가장 올바른 첫 번째 행동은?", options: ["친구와 함께 몰래 쓸어 담는다", "맨손으로 빠르게 닦아낸다", "당황하지 않고 현장 상황을 교사에게 알린다", "다른 약품을 섞어 냄새를 없앤다"], correct: 2, section: 3 },
        { q: "과학실 내에서의 음식물 섭취에 대한 규칙으로 올바른 것은?", options: ["냄새가 나지 않는 생수는 마실 수 있다", "뚜껑이 있는 텀블러에 담긴 음료는 허용된다", "실험이 끝나면 간식을 먹어도 된다", "어떠한 형태의 음식물 보관 및 섭취도 엄격히 금지된다"], correct: 3, section: 1 },
        { q: "산성 용액 폐수와 사용한 탈지면, 깨진 유리 조각을 버리는 가장 올바른 방법은?", options: ["물로 희석하여 싱크대에 흘려보낸다", "폐수 수집 용기에 한꺼번에 모두 버린다", "일반 쓰레기통에 액체와 고체를 모두 붓는다", "고형물이 섞이지 않도록 분리하여 각각 지정된 곳에 배출한다"], correct: 3, section: 2 },
        { q: "과학실에서 학생들의 부주의로 인해 가장 빈번하게 발생하는 사고 중 하나는?", options: ["ㄱ자 유리관에 고무관을 무리하게 끼우다가 유리가 깨져 다치는 사고", "현미경을 떨어뜨려 발등을 찍히는 사고", "의자에서 떨어져 다리를 삐는 사고", "실험실 문에 손가락이 끼이는 사고"], correct: 0, section: 1 },
        { q: "화학 실험 시 학생이 피부를 보호하기 위해 착용해야 하는 올바른 손 보호 장구는?", options: ["나이트릴 고무 재질 등의 내화학 장갑", "미끄럼 방지용 일반 면장갑", "겨울용 털장갑", "수술용 얇은 비닐장갑"], correct: 0, section: 1 },
        { q: "실험을 시작하기 전, 학생이 가장 먼저 참여해야 하는 활동은 무엇인가요?", options: ["즉시 시약을 섞어 실험 준비를 한다", "당일 실험의 위험 요인을 파악하는 5분 안전교육을 듣는다", "옆 조의 실험 도구를 빌려온다", "창문을 모두 닫아 밀폐시킨다"], correct: 1, section: 1 },
        { q: "미성년자인 초·중·고등학생이 과학실에서 절대 직접 수행해서는 안 되는 실험은?", options: ["오징어나 조개 해부", "물벼룩의 자극과 반응 관찰", "살아있는 개구리나 생쥐 등 척추동물 해부", "초파리 돌연변이 관찰"], correct: 2, section: 1 },
        { q: "시약병을 다룰 때 시약이 눈에 튀는 사고를 예방하기 위해 반드시 착용해야 하는 것은?", options: ["방연 마스크", "방염 담요", "보안경", "귀마개"], correct: 2, section: 1 },
        { q: "가열 기구나 전열 기구가 있는 콘센트 주변을 이동할 때 가장 조심해야 할 상황은?", options: ["바닥에 떨어진 지우개를 밟는 것", "콘센트 선에 발이 걸려 가열 중인 기구가 떨어지는 것", "친구와 부딪혀 책을 떨어뜨리는 것", "의자에 옷이 걸리는 것"], correct: 1, section: 1 },
        { q: "현미경 실험 중 덮개유리(커버글라스)가 깨져 흩어졌을 때 올바른 대처법은?", options: ["손바닥으로 짚어서 한 번에 모은다", "입으로 불어서 바닥으로 날려 보낸다", "그대로 두고 하교한다", "빗자루나 도구를 이용해 안전하게 모으고 교사에게 알린다"], correct: 3, section: 3 },
        { q: "동전 도금 실험 후 남은 아연 가루를 일반 쓰레기통에 버리면 발생하는 위험은?", options: ["쓰레기통 주변에 악취가 난다", "금속 가루가 방과 후 자연발화되어 화재가 발생할 수 있다", "쓰레기통 바닥이 부식되어 구멍이 난다", "아무런 문제도 발생하지 않는다"], correct: 1, section: 2 },
        { q: "암모니아처럼 냄새가 나는 기체의 냄새를 맡아야 할 때 올바른 방법은?", options: ["코를 용기 입구에 바짝 대고 숨을 깊게 들이마신다", "손으로 바람을 일으켜 기체가 코 쪽으로 오게 하여 살짝 맡는다", "비커를 흔들어서 기체를 사방으로 퍼뜨린다", "친구의 얼굴 쪽으로 밀어 확인하게 한다"], correct: 1, section: 1 },
        { q: "자석의 자기장 측정 등 물리 실험을 할 때도 보안경을 써야 하는 이유는?", options: ["자기장이 시력을 떨어뜨리기 때문에", "자석끼리 강하게 부딪히면 깨진 조각이 눈에 튈 수 있기 때문에", "물리 실험실의 조명이 너무 밝기 때문에", "규정상 무조건 써야 하므로"], correct: 1, section: 1 },
        { q: "사용하고 남은 화학 약품(폐수)을 일반 싱크대에 버려도 될까요?", options: ["물을 많이 틀어 희석하면 버려도 된다", "냄새가 나지 않는 투명한 액체는 버려도 된다", "비누와 섞어서 버리면 괜찮다", "환경 오염 및 배관 부식 위험이 있으므로 절대 버리지 않는다"], correct: 3, section: 2 },
        { q: "실수로 온도계를 떨어뜨려 수은이 바닥에 쏟아졌을 때 가장 먼저 해야 할 일은?", options: ["절대 만지거나 흩어지지 않게 하고 즉시 교사에게 알린 후 대피한다", "진공청소기로 깨끗하게 빨아들인다", "빗자루로 재빨리 쓸어 일반 쓰레기통에 버린다", "물걸레로 넓게 닦아낸다"], correct: 0, section: 3 },
        { q: "산성 폐수와 알칼리성(염기성) 폐수를 하나의 통에 섞어서 버려도 될까요?", options: ["통을 절약하기 위해 섞어 버려야 한다", "섞이면 중화되어 안전하므로 섞어 버린다", "성분이 다르면 섞일 때 열이나 유독 가스가 발생할 수 있으므로 절대 섞지 않는다", "색깔이 비슷하면 섞어도 된다"], correct: 2, section: 2 },
        { q: "실험 종료 후, 실험대에 묻어있던 투명한 약품을 닦지 않고 그대로 두면 어떤 일이 벌어질 수 있나요?", options: ["자연스럽게 공기 중으로 날아가 없어진다", "약품이 책상을 코팅하여 더 깨끗해진다", "다음 시간 다른 학생의 피부에 닿아 화상이나 손상을 입힐 수 있다", "아무런 일도 발생하지 않는다"], correct: 2, section: 1 },
        { q: "화재 진압용으로 구비된 소방 담요(방염 담요)를 사용할 때 주의해야 할 점은?", options: ["물에 흠뻑 적셔서 사용해야 한다", "표면의 유리 섬유가 손에 박힐 수 있으므로 피부 마찰에 주의한다", "불이 난 곳 위에서 강하게 펄럭이며 덮어야 한다", "담요를 덮고 그 위에 바로 물을 붓는다"], correct: 1, section: 3 },
        { q: "과학실에서 실험 기구를 씻으러 개수대로 이동할 때 주의할 점은?", options: ["바닥에 튄 물에 미끄러울 수 있으므로 바닥을 살피며 걷는다", "무거운 기구를 들고 최대한 빨리 뛰어간다", "양손에 비커를 가득 들고 앞을 보지 않고 걷는다", "편안한 슬리퍼로 갈아신고 걷는다"], correct: 0, section: 1 },
        { q: "실험실 화재나 약품 노출 사고의 응급조치가 끝난 직후, 학생이 해야 할 행동은?", options: ["놀란 마음을 진정시키기 위해 조용히 집으로 간다", "자신이 다치지 않았으면 굳이 알리지 않는다", "사고 현장을 구경하기 위해 주변으로 몰려든다", "추가 신체 이상이 없는지 확인하고 교사의 지시에 따라 진료를 받는다"], correct: 3, section: 3 },
        { q: "알코올램프나 핫플레이트를 이용한 가열 실험 직후, 실험 기구를 다룰 때 올바른 행동은?", options: ["뜨거울 수 있으므로 내열 장갑이나 집게를 사용한다", "빨리 식히기 위해 찬물에 바로 담근다", "맨손으로 잡고 조심스럽게 옮긴다", "입으로 불어서 식힌 후 맨손으로 잡는다"], correct: 0, section: 1 },
        { q: "향 연기를 피우거나 기체가 발생하는 실험을 할 때 학생의 건강을 지키기 위한 올바른 방법은?", options: ["기체가 흩어지지 않게 창문을 모두 닫는다", "발생한 기체를 가까이서 깊게 들이마셔 확인한다", "어지럼증을 예방하기 위해 환기팬을 켜거나 창문을 열어 환기한다", "냄새가 나면 실험실 바닥에 엎드려 있는다"], correct: 2, section: 1 },
        { q: "실험에 사용할 화학 약품을 덜어올 때 가장 올바른 방법은?", options: ["부족하지 않게 항상 넉넉한 양을 덜어온다", "실험에 필요한 최소한의 양만 덜어서 잔량이 남지 않게 한다", "남은 시약은 원래 시약병에 다시 부어 넣는다", "필요한 양을 눈대중으로 대충 덜어온다"], correct: 1, section: 2 },
        { q: "과학실에서 젖은 손으로 콘센트나 전기 기구를 만지면 안 되는 가장 큰 이유는?", options: ["기구에 녹이 슬 수 있으므로", "전기가 끊어져 실험이 중단되므로", "미량의 전류가 흘러 감전 사고가 발생할 수 있으므로", "손이 건조해질 수 있으므로"], correct: 2, section: 1 },
        { q: "과학실에서 실험을 할 때 안전을 위한 가장 올바른 복장 및 태도는?", options: ["발등이 드러나는 샌들이나 슬리퍼를 신는다", "소매가 펄럭이는 넓은 옷을 입어 활동을 편하게 한다", "긴 머리를 단정하게 묶고 실험복을 착용한다", "멋을 위해 보호용 안경 대신 콘택트렌즈만 착용한다"], correct: 2, section: 1 },
        { q: "MSDS(물질안전보건자료)에서 유해성·위험성의 정도를 나타내는 '신호어' 중 더 큰 위험을 경고할 때 사용하는 단어는 무엇인가요?", options: ["주의", "위험", "경고", "조심"], correct: 1, section: 4 },
        { q: "실험 중 화학물질이 눈에 튀어 들어갔을 때 MSDS에서 공통적으로 권장하는 기본 응급조치는 무엇인가요?", options: ["손으로 비벼서 즉시 빼낸다", "알코올로 눈을 소독한다", "다량의 물이나 생리식염수로 15분 이상 씻어낸다", "약품이 마를 때까지 눈을 감고 기다린다"], correct: 2, section: 3 },
        { q: "묽은 염산(Hydrochloric Acid)과 같이 부식성이 강한 물질을 실수로 삼켰을 때의 응급조치로 가장 올바른 것은?", options: ["손가락을 넣어 억지로 구토를 유도한다", "입을 씻어내고, 억지로 토하게 하지 않는다", "우유나 물을 다량으로 마셔서 중화시킨다", "알칼리성 물질을 먹어 산을 중화시킨다"], correct: 1, section: 3 },
        { q: "녹색 BTB 용액(Green Bromothymol Blue Solution) 취급에 대한 MSDS 설명으로 올바른 것은 무엇인가요?", options: ["인화성이 매우 높아 화기를 피해야 한다", "발암물질이므로 흄 후드에서만 취급해야 한다", "화학물질로 인한 유해성이 없어 일반적인 조건에서는 보호구가 필요하지 않다", "피부 부식성이 강해 내화학성 장갑이 필수적이다"], correct: 2, section: 4 },
        { q: "아세톤(Acetone)의 취급 및 저장 방법으로 가장 적절한 것은?", options: ["인화점이 낮으므로 열, 불꽃, 화염 등 점화원과 접촉을 피한다", "환기가 안 되는 밀폐된 좁은 공간에 보관한다", "물과 강하게 반응하므로 습기 찬 곳에 보관한다", "달콤한 냄새가 나므로 방향제 대용으로 교실에 둔다"], correct: 0, section: 2 },
        { q: "화학물질 취급 후 학생이 개인위생을 위해 가장 먼저 실천해야 할 예방조치는 무엇인가요?", options: ["남은 시약은 원래 시약병에 다시 넣는다", "취급 부위(손 등)를 비누와 물로 철저히 씻는다", "보호구를 벗고 즉시 식사를 한다", "사용한 실험복을 친구에게 물려준다"], correct: 1, section: 1 },
        { q: "질산칼륨(Potassium Nitrate)의 특성으로 MSDS에 명시된 주요 유해·위험성은 무엇인가요?", options: ["물과 반응하여 폭발성 가스를 발생시킨다", "가연성 물질과 닿으면 화재를 강렬하게 하는 산화성 물질이다", "맹독성 가스를 지속적으로 방출한다", "피부에 닿으면 즉각적인 동상을 일으킨다"], correct: 1, section: 4 },
        { q: "학교에 보관 중인 묽은 염산(Hydrochloric Acid 0.1M)의 NFPA(미국방화협회) 지수 중 가장 위험도가 높은 항목(3단계)은 무엇인가요?", options: ["화재 (인화성)", "반응성", "보건 (건강 위험)", "방사능"], correct: 2, section: 4 },
        { q: "메틸알코올(Methyl alcohol)처럼 흡입 시 유독한 물질이 공기 중에 퍼지는 것을 막기 위해 지켜야 할 조치는?", options: ["옥외 또는 환기가 잘 되는 곳에서만 취급한다", "실험실 창문을 모두 닫아 공기를 밀폐한다", "일반 얇은 면 마스크만 착용하면 충분하다", "숨을 참아가며 빠르게 실험을 끝낸다"], correct: 0, section: 2 },
        { q: "질산구리(Copper(II) Nitrate trihydrate) 시약이 바닥에 유출되었을 때 정화 방법으로 절대 해서는 안 되는 행동은?", options: ["유출물을 모아 지정된 폐기물 용기에 담는다", "톱밥과 같은 가연성 물질을 덮어 흡수시킨다", "보호의를 착용하지 않은 상태에서 손대지 않는다", "수건으로 가볍게 덮어둔다"], correct: 1, section: 2 },
        { q: "피부에 유해한 화학물질이 묻었을 때 MSDS에 명시된 기본 대처법은 무엇인가요?", options: ["수건으로 가볍게 닦아낸 후 실험을 계속한다", "오염된 의복을 즉시 벗고 15분 이상 다량의 물과 비누로 씻어낸다", "반대 성질의 화학약품을 발라 중화시킨다", "자연적으로 증발할 때까지 기다린다"], correct: 1, section: 3 },
        { q: "황산(Sulfuric acid)의 물리화학적 특성 중, 용액의 액성을 나타내는 pH 값에 대한 설명으로 올바른 것은?", options: ["pH 7 (중성)", "pH 10 이상 (강염기성)", "pH 2 미만 (강산성)", "자료 없음"], correct: 2, section: 4 },
        { q: "에탄올(Ethyl alcohol)과 같이 인화성이 강한 액체에 화재가 발생했을 때 화재 진압용으로 부적절한 방법은?", options: ["분말 소화기 사용", "이산화탄소(CO2) 소화기 사용", "내알코올성 포말 소화기 사용", "직접적인 물 분사"], correct: 3, section: 3 },
        { q: "학교에 있는 시약들의 MSDS에 공통적으로 명시된 '사용상의 제한' 조건은 무엇인가요?", options: ["음용 불가하며 실험실 및 연구용 시약 외의 용도로 사용 금지", "청소용 세제로 자유롭게 사용 가능", "식품 첨가물 및 조미료로 사용 가능", "손 소독용으로 사용 가능"], correct: 0, section: 4 },
        { q: "페놀 레드(Phenol red)나 염화마그네슘6수화물 등의 시약이 불에 타는 등 열 분해될 때 공통적으로 발생하는 위험은?", options: ["열 분해에 의해 탄소 산화물 등 유해한 가스나 흄이 발생할 수 있다", "열을 흡수하여 주변 온도를 급격히 영하로 낮춘다", "산소와 결합하여 무해한 물방울로 변한다", "자연적으로 소화 작용을 일으켜 불을 끈다"], correct: 0, section: 2 },
        { q: "우리 학교에서 실험 후 발생한 묽은 염산이나 질산납 등의 화학 폐기물은 어떻게 처리해야 하나요?", options: ["싱크대에 물을 틀어놓고 함께 흘려보낸다", "일반 쓰레기통에 휴지와 함께 버린다", "운동장이나 화단 흙에 부어 자연 정화시킨다", "폐기물관리법 관련 규정에 따라 지정폐기물로 분리하여 수거한다"], correct: 3, section: 2 },
        { q: "화학물질 취급 장소(과학실) 주변에 항상 설치되어 있어야 하며 눈에 약품이 튀었을 때 즉시 사용해야 하는 설비는?", options: ["제빙기 및 냉동고", "눈 세척시설 및 비상세안장치", "초음파 세척기", "의류 건조기"], correct: 1, section: 3 },
        { q: "아세톤은 밀폐된 공간에서 장기간 증기를 흡입할 경우 우리 몸에 어떤 증상을 유발할 수 있다고 경고하고 있나요?", options: ["시력 교정", "졸음 또는 현기증", "근력 및 지구력 강화", "식욕 증진 및 소화 불량"], correct: 1, section: 2 },
        { q: "화학 실험 중 시약을 취급할 때, 화학물질이 튀어 눈이 손상되는 것을 막기 위해 MSDS에서 공통적으로 착용을 의무화하고 있는 것은?", options: ["콘택트렌즈", "자외선 차단 선글라스", "안전 인증을 받은 보안경 또는 안면보호구", "수영용 물안경"], correct: 2, section: 1 }
    ];

    /**
     * Generates a set of possible question templates for a given inventory item.
     * @param {Object} item - Inventory item with substance, location_area, etc.
     * @returns {Array} Array of question objects
     */
    /**
     * Generates a set of possible question templates for a given inventory item.
     * @param {Object} item - Inventory item
     * @param {Array} allItems - Full list of items for generating distractors
     * @returns {Array} Array of question objects
     */
    /**
     * Helper to create a randomized question object.
     * Shuffles options and finds the new index for the correct answer.
     */
    function createRandomizedQuestion(questionText, correctAnswer, wrongAnswers) {
        // 1. Combine correct answer and distractors (max 3 distractors)
        const pool = [correctAnswer, ...wrongAnswers.slice(0, 3)];

        // 2. Shuffle
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        // 3. Find new index of correct answer
        const correctIndex = pool.indexOf(correctAnswer);

        return {
            section: "스마트 과학실 화학물질 식별",
            q: questionText,
            options: pool,
            correct: correctIndex
        };
    }

    /**
     * Generates a set of possible question templates for a given inventory item.
     * @param {Object} item - Inventory item
     * @param {Array} allItems - Full list of items for generating distractors
     * @returns {Array} Array of question objects
     */
    function getDynamicTemplates(item, allItems = []) {
        const templates = [];
        const s = item.Substance || item.substance || {};
        const c = item.Cabinet || item.location_cabinet || {};
        const a = c.area_id || item.location_area || {};

        // Helper to pick distractors
        const pickDistractors = (sourceList, correctVal, count = 3) => {
            const others = sourceList.filter(v => v && v !== correctVal);
            // Shuffle
            for (let i = others.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [others[i], others[j]] = [others[j], others[i]];
            }
            return others.slice(0, count);
        };

        // 1. Storage Location (Detailed)
        const formatLocation = (val) => {
            const cabinetObj = val.Cabinet || val.location_cabinet || {};
            const areaObj = cabinetObj.area_id || val.location_area || {};

            const area = areaObj.room_name || areaObj.name || "";
            const cab = cabinetObj.cabinet_name || cabinetObj.name || "";
            const v = val.door_vertical || "";
            const h = val.door_horizontal || "";
            const hCount = Number(cabinetObj.door_horizontal_count || val.door_horizontal_count || 0);

            let locText = "";
            if (area) locText += `${area} `;
            if (cab) locText += `『${cab}』 `;

            let doorPart = "";
            const doorHVal = String(h || "").trim();
            let doorHLabel = "";
            if (hCount > 1) {
                if (doorHVal === "1") doorHLabel = "왼쪽";
                else if (doorHVal === "2") doorHLabel = "오른쪽";
                else doorHLabel = doorHVal;
            }

            if (v && doorHLabel) {
                doorPart = `${v}층 ${doorHLabel}문`;
            } else if (v) {
                doorPart = `${v}층문`;
            } else if (doorHLabel) {
                doorPart = `${doorHLabel}문`;
            }

            let shelfPart = "";
            const shelfVal = val.internal_shelf_level;
            const colVal = val.storage_column;

            if (shelfVal && colVal) {
                shelfPart = `${shelfVal}단 ${colVal}열`;
            } else {
                if (shelfVal) shelfPart += `${shelfVal}단`;
                if (colVal) shelfPart += (shelfPart ? " " : "") + `${colVal}열`;
            }

            const detailParts = [doorPart, shelfPart].filter(Boolean).join(", ");
            if (detailParts) locText += detailParts;

            return locText.trim();
        };

        const locName = formatLocation(item);
        if (locName && locName !== "위치: 미확인") {
            const generateLocationDistractors = (correctLoc) => {
                const places = ["과학준비실", "제1과학실", "제2과학실", "생물실", "화학실", "물리실"];
                const cabinetTypes = ["시약장", "냉장고", "캐비닛", "밀폐식 시약장"];
                const cabinetNumbers = ["1", "2", "3", "A", "B"];
                const floors = ["1", "2", "3", "4"];
                const sides = ["왼쪽", "오른쪽", ""];
                const shelves = ["1", "2", "3", "4", "5"];
                const columns = ["1", "2", "3", "4"];

                const dists = [];
                let attempts = 0;

                const correctArea = (a.room_name || a.name || "과학준비실").trim();
                const correctCab = (c.cabinet_name || c.name || "시약장1").trim();

                while (dists.length < 3 && attempts < 100) {
                    attempts++;
                    
                    let area = places[Math.floor(Math.random() * places.length)];
                    let cabType = cabinetTypes[Math.floor(Math.random() * cabinetTypes.length)];
                    let cabNum = cabinetNumbers[Math.floor(Math.random() * cabinetNumbers.length)];
                    let cab = `${cabType}${cabNum}`;
                    
                    if (Math.random() > 0.5) {
                        area = correctArea;
                    }
                    if (Math.random() > 0.5) {
                        let cType = "시약장";
                        for (const t of cabinetTypes) {
                            if (correctCab.includes(t)) {
                                cType = t;
                                break;
                            }
                        }
                        cab = `${cType}${cabinetNumbers[Math.floor(Math.random() * cabinetNumbers.length)]}`;
                    }

                    let v = floors[Math.floor(Math.random() * floors.length)];
                    let h = sides[Math.floor(Math.random() * sides.length)];
                    let shelfVal = shelves[Math.floor(Math.random() * shelves.length)];
                    let colVal = columns[Math.floor(Math.random() * columns.length)];

                    let locText = `${area} 『${cab}』 `;
                    
                    let doorPart = "";
                    if (v && h) {
                        doorPart = `${v}층 ${h}문`;
                    } else if (v) {
                        doorPart = `${v}층문`;
                    } else if (h) {
                        doorPart = `${h}문`;
                    }

                    let shelfPart = "";
                    if (shelfVal && colVal) {
                        shelfPart = `${shelfVal}단 ${colVal}열`;
                    } else {
                        if (shelfVal) shelfPart += `${shelfVal}단`;
                        if (colVal) shelfPart += (shelfPart ? " " : "") + `${colVal}열`;
                    }

                    const detailParts = [doorPart, shelfPart].filter(Boolean).join(", ");
                    if (detailParts) locText += detailParts;

                    const finalLoc = locText.trim();

                    if (finalLoc && finalLoc !== correctLoc && !dists.includes(finalLoc)) {
                        dists.push(finalLoc);
                    }
                }

                // Fallback in case of lack of unique items
                while (dists.length < 3) {
                    const fallback = `제${dists.length + 1}과학실 『시약장${dists.length + 2}』 1층문, 2단 2열`;
                    if (!dists.includes(fallback) && fallback !== correctLoc) {
                        dists.push(fallback);
                    }
                }

                return dists;
            };

            const distractors = generateLocationDistractors(locName);

            templates.push(createRandomizedQuestion(
                `'${s.chem_name_kor || s.substance_name || ''}'의 보관 위치로 올바른 곳은?`,
                locName,
                distractors
            ));
        }

        // 2. Chemical Formula
        if (s.molecular_formula && s.molecular_formula.length > 1) {
            const distractors = pickDistractors(
                allItems.map(i => {
                    const sub = i.Substance || i.substance;
                    return sub?.molecular_formula;
                }).filter(f => f && f.length > 1),
                s.molecular_formula
            );
            if (distractors.length < 3) distractors.push("H2O", "NaCl", "CO2"); // Fallbacks

            templates.push(createRandomizedQuestion(
                `'${s.chem_name_kor || s.substance_name || ''}'의 화학식으로 올바른 것은?`,
                s.molecular_formula,
                distractors
            ));
        }

        // 3. CAS Number (Advanced)
        if (s.cas_rn && /^\d+-\d+-\d$/.test(s.cas_rn)) {
            const distractors = pickDistractors(
                allItems.map(i => {
                    const sub = i.Substance || i.substance;
                    return sub?.cas_rn;
                }).filter(c => c && /^\d+-\d+-\d$/.test(c)),
                s.cas_rn
            );
            if (distractors.length < 3) distractors.push("7732-18-5", "7647-14-5", "64-17-5"); // Water, Salt, Ethanol

            templates.push(createRandomizedQuestion(
                `'${s.chem_name_kor || s.substance_name || ''}'의 CAS 등록번호(고유번호)는?`,
                s.cas_rn,
                distractors
            ));
        }

        // 4. Hazard Classification
        const hazards = [];
        if (s.toxic_substance_standard === 'Y') hazards.push("유독물질");
        if (s.restricted_substance_standard === 'Y') hazards.push("제한물질");
        if (s.prohibited_substance_standard === 'Y') hazards.push("금지물질");
        if (s.school_hazardous_chemical_standard === 'Y') hazards.push("학교유해화학물질");
        if (s.school_hazardous_chemical_standard !== 'Y' && s.toxic_substance_standard !== 'Y') hazards.push("일반물질(해당없음)");

        if (hazards.length > 0) {
            const answer = hazards[0];
            const hazardOptions = ["유독물질", "제한물질", "금지물질", "학교유해화학물질", "일반물질(해당없음)"].filter(o => o !== answer);

            templates.push(createRandomizedQuestion(
                `'${s.chem_name_kor || s.substance_name || ''}'은(는) 학교 안전관리 기준상 어떻게 분류됩니까?`,
                answer,
                hazardOptions
            ));
        }

        // 5. English Name Quiz
        if (s.substance_name) {
            const distractors = pickDistractors(
                allItems.map(i => {
                    const sub = i.Substance || i.substance;
                    return sub?.substance_name;
                }).filter(n => n && n !== s.substance_name),
                s.substance_name
            );
            if (distractors.length < 3) distractors.push("Water", "Sodium Chloride", "Ethanol");

            templates.push(createRandomizedQuestion(
                `'${s.chem_name_kor || s.substance_name || ''}'의 영문명으로 올바른 것은?`,
                s.substance_name,
                distractors
            ));
        }

        // 6. Reverse Formula Quiz
        if (s.molecular_formula && s.molecular_formula.length > 1) {
            // Distractors are other Korean names
            const distractors = pickDistractors(
                allItems.map(i => {
                    const sub = i.Substance || i.substance;
                    return sub?.chem_name_kor || sub?.substance_name;
                }).filter(n => n && n !== s.chem_name_kor),
                s.chem_name_kor
            );
            if (distractors.length < 3) distractors.push("물", "염화나트륨", "에탄올");

            templates.push(createRandomizedQuestion(
                `다음 화학식을 가진 물질은? [ ${s.molecular_formula} ]`,
                s.chem_name_kor,
                distractors
            ));
        }

        // 7. Reverse CAS Quiz
        if (s.cas_rn && /^\d+-\d+-\d$/.test(s.cas_rn)) {
            const distractors = pickDistractors(
                allItems.map(i => {
                    const sub = i.Substance || i.substance;
                    return sub?.chem_name_kor || sub?.substance_name;
                }).filter(n => n && n !== s.chem_name_kor),
                s.chem_name_kor
            );
            if (distractors.length < 3) distractors.push("물", "염화나트륨", "에탄올");

            templates.push(createRandomizedQuestion(
                `다음 CAS 번호(고유번호)에 해당하는 물질은? [ ${s.cas_rn} ]`,
                s.chem_name_kor,
                distractors
            ));
        }

        return templates;
    }

    /**
     * Generates a "Which is heaviest?" question from a list of items.
     */
    function getMassComparisonQuestion(items) {
        const validItems = items.filter(i => {
            const sub = i.Substance || i.substance;
            const m = parseFloat(sub?.molecular_mass);
            return m > 0 && (sub?.chem_name_kor || sub?.substance_name);
        });

        if (validItems.length < 4) return null;

        // Shuffle and pick 4 unique items
        const picked = [];
        const indices = new Set();
        while (picked.length < 4) {
            const idx = Math.floor(Math.random() * validItems.length);
            if (!indices.has(idx)) {
                indices.add(idx);
                picked.push(validItems[idx]);
            }
        }

        // Find max mass
        let maxItem = picked[0];
        const getMolMass = (p) => parseFloat((p.Substance || p.substance).molecular_mass);
        const getName = (p) => (p.Substance || p.substance).chem_name_kor || (p.Substance || p.substance).substance_name;
        let maxMass = getMolMass(picked[0]);

        picked.forEach(p => {
            const m = getMolMass(p);
            if (m > maxMass) {
                maxMass = m;
                maxItem = p;
            }
        });

        const correctName = getName(maxItem);

        // This time, picked IS the pool (4 items). 
        // We just need to shuffle their names and find the index of the correct name.
        const options = picked.map(p => getName(p));

        // Shuffle options
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }

        const correctIndex = options.indexOf(correctName);

        return {
            section: "스마트 과학실 화학물질 식별",
            q: "다음 중 분자량이 가장 큰(무거운) 물질은 무엇입니까?",
            options: options,
            correct: correctIndex
        };
    }

    const DEFAULT_SAMPLE_ITEMS = [
        {
            Substance: { chem_name_kor: "에탄올", substance_name: "Ethanol", molecular_formula: "C2H5OH", cas_rn: "64-17-5", molecular_mass: "46.07", toxic_substance_standard: "N", restricted_substance_standard: "N", school_hazardous_chemical_standard: "N" },
            Cabinet: { cabinet_name: "인화성 시약장", door_horizontal_count: 2, area_id: { room_name: "화학실" } },
            door_vertical: "1", door_horizontal: "1", internal_shelf_level: "2", storage_column: "1"
        },
        {
            Substance: { chem_name_kor: "묽은 염산", substance_name: "Hydrochloric Acid", molecular_formula: "HCl", cas_rn: "7647-01-0", molecular_mass: "36.46", toxic_substance_standard: "Y", restricted_substance_standard: "N", school_hazardous_chemical_standard: "Y" },
            Cabinet: { cabinet_name: "부식성 시약장", door_horizontal_count: 2, area_id: { room_name: "과학준비실" } },
            door_vertical: "2", door_horizontal: "2", internal_shelf_level: "1", storage_column: "2"
        },
        {
            Substance: { chem_name_kor: "아세톤", substance_name: "Acetone", molecular_formula: "C3H6O", cas_rn: "67-64-1", molecular_mass: "58.08", toxic_substance_standard: "N", restricted_substance_standard: "N", school_hazardous_chemical_standard: "N" },
            Cabinet: { cabinet_name: "인화성 시약장", door_horizontal_count: 2, area_id: { room_name: "화학실" } },
            door_vertical: "1", door_horizontal: "2", internal_shelf_level: "3", storage_column: "1"
        },
        {
            Substance: { chem_name_kor: "수산화나트륨", substance_name: "Sodium Hydroxide", molecular_formula: "NaOH", cas_rn: "1310-73-2", molecular_mass: "39.99", toxic_substance_standard: "Y", restricted_substance_standard: "N", school_hazardous_chemical_standard: "Y" },
            Cabinet: { cabinet_name: "밀폐식 시약장", door_horizontal_count: 2, area_id: { room_name: "과학준비실" } },
            door_vertical: "1", door_horizontal: "1", internal_shelf_level: "1", storage_column: "1"
        },
        {
            Substance: { chem_name_kor: "과산화수소", substance_name: "Hydrogen Peroxide", molecular_formula: "H2O2", cas_rn: "7722-84-1", molecular_mass: "34.01", toxic_substance_standard: "N", restricted_substance_standard: "N", school_hazardous_chemical_standard: "Y" },
            Cabinet: { cabinet_name: "시약장 A", door_horizontal_count: 2, area_id: { room_name: "제1과학실" } },
            door_vertical: "2", door_horizontal: "1", internal_shelf_level: "2", storage_column: "3"
        },
        {
            Substance: { chem_name_kor: "질산칼륨", substance_name: "Potassium Nitrate", molecular_formula: "KNO3", cas_rn: "7757-79-1", molecular_mass: "101.10", toxic_substance_standard: "N", restricted_substance_standard: "N", school_hazardous_chemical_standard: "N" },
            Cabinet: { cabinet_name: "시약장 B", door_horizontal_count: 2, area_id: { room_name: "제2과학실" } },
            door_vertical: "1", door_horizontal: "2", internal_shelf_level: "3", storage_column: "2"
        }
    ];

    function getFallbackDynamicQuestions() {
        // Return a list of fallback questions generated from sample chemical data if DB fetch fails or returns empty
        const list = [];
        
        // 1. Generate questions using sample items templates
        DEFAULT_SAMPLE_ITEMS.forEach(item => {
            const templates = getDynamicTemplates(item, DEFAULT_SAMPLE_ITEMS);
            list.push(...templates);
        });

        // 2. Add mass comparison question from sample items
        const massQ = getMassComparisonQuestion(DEFAULT_SAMPLE_ITEMS);
        if (massQ) list.push(massQ);

        // 3. Add system name question as a single complementary item
        list.push(createRandomizedQuestion(
            `스마트 과학실 관리 시스템의 이름은?`,
            "SciManager",
            ["LabHelper", "SafeSchool", "SmartLab"]
        ));

        // Shuffle the list
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }

        return list;
    }


    /**
     * Shuffles the options of a fixed question object.
     * @param {Object} original - { q, options, correct, section }
     */
    function randomizeFixedQuestion(original) {
        const correctVal = original.options[original.correct];
        const wrongs = original.options.filter((_, i) => i !== original.correct);
        const randQ = createRandomizedQuestion(original.q, correctVal, wrongs);
        randQ.section = original.section; // 원래 섹션 유지
        return randQ;
    }

    // FIXED_POOL을 4개의 섹션으로 자동 분류
    const SECTION_MAP = {
        1: "실험실 기본 안전 및 보호구",
        2: "화학물질 취급 및 폐기물 처리",
        3: "응급 대처 및 화재 예방",
        4: "GHS 및 MSDS의 이해"
    };

    const classifyFixedPool = () => {
        const seenTexts = new Set();
        const deduplicated = [];

        FIXED_POOL.forEach(q => {
            const normKey = (q.q || "").replace(/\s+/g, "").toLowerCase();
            if (seenTexts.has(normKey)) return;
            seenTexts.add(normKey);

            if (typeof q.section === 'number' && SECTION_MAP[q.section]) {
                q.section = SECTION_MAP[q.section];
            }
            if (!q.section) {
                const text = q.q + " " + q.options.join(" ");
                if (text.includes("GHS") || text.includes("MSDS") || text.includes("물질안전보건자료") || text.includes("신호어") || text.includes("CAS") || text.includes("NFPA")) {
                    q.section = "GHS 및 MSDS의 이해";
                } else if (text.includes("응급") || text.includes("안구 세척기") || text.includes("비상 샤워기") || text.includes("소화기") || text.includes("화재") || text.includes("신고") || text.includes("구토") || text.includes("119") || text.includes("화기 엄금") || text.includes("소방 담요")) {
                    q.section = "응급 대처 및 화재 예방";
                } else if (text.includes("폐액") || text.includes("폐수") || text.includes("버릴") || text.includes("버려도") || text.includes("폐기물") || text.includes("보관") || text.includes("덜어") || text.includes("유기 용제") || text.includes("시약장") || text.includes("싱크대") || text.includes("개수대") || text.includes("흄 후드") || text.includes("환풍기") || text.includes("환기")) {
                    q.section = "화학물질 취급 및 폐기물 처리";
                } else {
                    q.section = "실험실 기본 안전 및 보호구";
                }
            }
            deduplicated.push(q);
        });

        FIXED_POOL.length = 0;
        FIXED_POOL.push(...deduplicated);
    };
    classifyFixedPool();

    globalThis.App = globalThis.App || {};
    globalThis.App.SafetyQuizData = {
        FIXED_POOL: FIXED_POOL,
        getDynamicTemplates: getDynamicTemplates,
        getFallbackDynamicQuestions: getFallbackDynamicQuestions,
        getMassComparisonQuestion: getMassComparisonQuestion,
        randomizeFixedQuestion: randomizeFixedQuestion
    };
})();
