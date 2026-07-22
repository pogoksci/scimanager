# 🔬 SciManager S.A.F.E 프로젝트로 구현하는 지능형 안전 과학실

![Version](https://img.shields.io/badge/version-2.5.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Web%20%7C%20Mobile-orange.svg)
![Database](https://img.shields.io/badge/database-Supabase%20%28PostgreSQL%29-emerald.svg)

> **SciManager **는 초·중·고등학교 과학실의 **시약장 재고 관리,
> 화학물질(MSDS/CAS) 조회, 실재고 기반 스마트 용액 조제 계산기, 대화형 AI 챗봇,
> 교구·실험키트 관리, 폐액 관리, 점심 자율 실험실 예약**을 하나로 통합한 스마트
> 과학실 종합 관리 플랫폼입니다.

---

## 🌟 주요 핵심 기능 (Key Features)

### 1. 🧪 실재고 기반 스마트 농도 변환 계산기 & 현장 맞춤형 레시피 엔진

- **자연어 조제 질의 즉시 처리**: _"염산 0.5M 20mL"_, _"0.1M 수산화나트륨
  500mL"_ 등 농도와 부피 질문 시 DB를 즉시 자동 분석합니다.
- **실재고 3단계 자동 선별 (Priority Selection)**:
  1. 🥇 **동일 농도 보유 ($1\text{N} = 1\text{M}$ 당량 환산 포함)**: 칭량/희석
     없이 바로 소분하여 즉시 사용 안내
  2. 🥈 **고농도 원액 희석**: $M = \frac{\% \times 10 \times d}{\text{MW}}$ 공식
     기반 원액 취출량 및 증류수 조제 절차 자동 계산
  3. 🥉 **고체 시료 칭량**: 순도 반영 필요 질량(g) 및 전자저울 영점(TARE) 용해
     레시피 반환
- **부피플라스크 규격(50mL ~ 1000mL) 동적 인터랙티브 스위칭**:
  - 교사/학생이 보유 중인 부피플라스크 크기 버튼 클릭 시 희석량 및 조제 비율이
    100% 실시간 재계산됩니다.
  - 선택한 부피플라스크 용량이 커서 시약병 잔여 재고를 초과하면
    **`[재고 부족]`** 배지 전환 및 잔여량이 충분한 다른 시약병으로 자동
    전환됩니다.
- **실험용 견출지 라벨 스티커 생성 & PNG/PDF 출력**:
  - 조제일, 농도, 부식성/산성 주의 문구와 함께 **제조자 이름을 현장에서 직접
    클릭 수정(`contenteditable`)**하여 견출지 라벨을 PNG/PDF 파일로 바로 저장 및
    인쇄할 수 있습니다.

### 2. 🤖 인공지능 대화형 과학실 챗봇 (AI Lab Assistant)

- **띄어쓰기 100% 흡수 다중 조인 탐색**: `탄산칼슘` $\leftrightarrow$
  `탄산 칼슘` 띄어쓰기 불일치를 음절 와일드카드 DB 쿼리와 JS 공백 정제 로직으로
  100% 자동 탐색합니다.
- **상세 위치 안내**: 보관함 위치를 `"과학준비실 > 시약장1 (2층문 3단 2열)"`과
  같이 층/단/열 단위로 직관적 안내합니다.
- **소방청 GHS 위험물 그림문자 연동**: MSDS 유해성/위험성 조회 시 소방청 GHS
  아이콘 배지 및 한글 명칭을 깔끔히 표시합니다.
- **교구·설비 세척 & 점검 매뉴얼 제공**: _"현미경 청소 방법"_, _"흄후드 점검
  주기"_, _"전자저울 수평 조절"_ 등 정비 지침 카드를 대화형으로 제공합니다.

### 3. 📦 시약장 & 화학 물질 (MSDS) 스마트 관리

- **3만여 개 화학 물질 마스터 DB 연동**: PubChem 및 소방청 화학 데이터 기반
  분자량, 표준 화학식(`NaOH`, `HCl` 등), CAS 번호 관리.
- **실시간 잔여량 및 상태 추적**: 보유 시약병의 현재 잔여
  수량($\text{mL}, \text{g}$)과 보관 상태 추적.
- **소진/폐기 시약병 자동 필터링**: `status`가 전량소진/폐기 상태이거나 잔여량이
  0 이하인 수량 부족 시약병은 조제 가능 목록에서 자동으로 제외됩니다.

### 4. 🧰 교육과정 교구·설비 & 실험 키트 관리

- 초·중·고 교육과정 과목별/단원별 실험 교구 및 키트 목록 통합 관리.
- 구입일자(`purchase_date`), 보관 위치, 현재 수량 및 상태 점검 기능 지원.

### 5. 🪣 폐액 처리 & 안전 수칙 모니터링

- 산성, 염기성, 유기계 폐액 용기별 잔여 용량 관리 및 폐기 처리 이력 작성.
- 실험실 안전 수칙 가이드 및 비상 조치 매뉴얼 제공.

### 6. 🍱 점심 자율 실험실 예약 시스템 (Lunch Lab Reserve)

- 학생 및 교사 대상 점심시간 자율 탐구 실험실 사용 신청, 승인 및 일정 관리.

### 7. 🔐 권한 관리 (RBAC) & 모바일 최적화 UI/UX

- **역할 기반 접근 제어 (RBAC)**: 교사(관리자) 및 학생/게스트 사용자 권한 분리.
- **모바일 웹 최적화**: 스마트폰 가상 키보드 입력 시 비밀번호/버튼 가림 방지,
  터치 영역 카드화 UI/UX 적용.

---

## 🛠️ 기술 스택 (Tech Stack)

| 구분                   | 사용 기술 / 라이브러리                                                    |
| :--------------------- | :------------------------------------------------------------------------ |
| **Frontend**           | HTML5, JavaScript (ES6+ Vanilla), CSS3 (Custom Properties, Flexbox, Grid) |
| **Backend / Database** | Supabase (PostgreSQL, Realtime Auth, Storage)                             |
| **PDF & Image Export** | `html2canvas`, `jsPDF`                                                    |
| **Design & Icons**     | Google Material Symbols, Google Fonts                                     |
| **CI/CD & Hosting**    | GitHub Actions, GitHub Pages                                              |

---

## 🗄️ 데이터베이스 구조 (Database Schema)

- **`Substance`**: 화학 물질 마스터 DB (화학명, `molecular_formula_mod`, 분자량,
  CAS 번호 등)
- **`Inventory`**: 실재고 시약병 DB (시약장 위치
  `door_vertical`/`shelf`/`column`, 잔여 수량 `current_amount`, 농도
  `concentration_value`/`unit`, 상태 `status`)
- **`Cabinet` & `lab_rooms`**: 과학실 공간 및 시약장 가구 구조 DB
- **`Synonyms` & `SubstanceRef`**: 화학 화합물 이명 및 Cross-Reference 대조 DB
- **`tools` & `kits`**: 교구·설비 및 교육과정 단원별 실험 키트 DB
- **`waste_records`**: 폐액 처리 및 용기 상태 관리 DB

---

## 🌐 웹 사이트 접속 및 이용 (Live App)

- **공식 서비스 URL**:
  [https://ggomcode.github.io/ggomsci/](https://ggomcode.github.io/ggomsci/)

---

## 📄 라이선스 (License)

본 프로젝트는 MIT 라이선스에 따라 자유롭게 사용 및 공유할 수 있습니다.
