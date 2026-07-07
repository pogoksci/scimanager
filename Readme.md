# User B를 위한 프로젝트 설치 및 시작 가이드

이 문서는 **신규 사용자(초보자)**가 프로젝트를 클론하여 자신의 컴퓨터에 설치하고
실행하기 위해 필요한 절차를 설명합니다.

## 1. 필수 프로그램 설치*

코드를 가져오고 실행하려면 다음 두 가지 프로그램이 필요합니다.

### 1-1. VS Code (Visual Studio Code) 설치

코드를 수정하고 관리하기 가장 쉬운 에디터입니다.

- [VS Code 다운로드](https://code.visualstudio.com/) 후 설치 (기본 설정 유지)

### 1-2. Git (깃) 설치

GitHub에 있는 코드를 내 컴퓨터로 가져오기 위한 도구입니다.

- [Git 다운로드](https://git-scm.com/download/win) 후 설치
- **중요:** 설치 중 나오는 모든 선택창에서 **수정 없이 "Next"만 계속 눌러서**
  설치를 완료하세요.

### 1-3. Node.js (노드) 설치

고급 기능(Supabase 서버 배포 등)을 사용하려면 필요합니다.

- [Node.js 다운로드](https://nodejs.org/) (LTS 버전 추천)
- 다운로드 받은 파일을 실행하여 설치합니다 (기본 설정 그대로 Next).

---

## 2. 프로젝트 코드 가져오기 (Git Clone)

**목표:** `D:\git` 폴더 안에 `scimanager` 라는 이름으로 코드를 가져옵니다.

### [방법 1] VS Code 터미널 사용하기 (추천)

1. **폴더 만들기**:
   - 내 컴퓨터에서 `D:` 드라이브로 들어갑니다.
   - `git` 이라는 이름의 새 폴더를 만듭니다 (이미 있다면 건너뜀).
2. **VS Code에서 폴더 열기**:
   - VS Code를 실행합니다.
   - 메뉴에서 **File > Open Folder**를 누르고 방금 만든 `D:\git` 폴더를
     선택합니다.
3. **터미널 열기**:
   - 메뉴에서 **Terminal > New Terminal**을 누릅니다.
4. **명령어 입력**:
   - 아래 명령어를 정확히 입력하고 엔터를 칩니다. (뒤에 `scimanager`이
     붙어있는지 꼭 확인하세요!)
   ```bash
   git clone https://github.com/pogoksci/scimanager.git
   ```
5. **완료 및 이동**:
   - 설치가 끝나면 왼쪽에 `scimanager` 폴더가 보입니다.
   - **[중요]** 메뉴에서 **File > Open Folder**를 다시 눌러서
     `D:\git\scimanager` 폴더를 새로 여세요.

### [방법 2] 윈도우 파워쉘(PowerShell) 사용하기

1. **폴더 준비**:
   - 파일 탐색기에서 `D:\git` 폴더로 이동합니다. (없으면 새로 만드세요)
2. **파워쉘 열기**:
   - `D:\git` 폴더 안의 빈 공간에 **[Shift] 키를 누른 채로 마우스 우클릭**
     합니다.
   - **"여기에 PowerShell 창 열기"**를 선택합니다.
3. **명령어 입력**:
   - 아래 명령어를 입력하고 엔터를 칩니다.
   ```powershell
   git clone https://github.com/pogoksci/scimanager.git
   ```
4. **결과 확인**:
   - `D:\git` 폴더 안에 `scimanager` 라는 폴더가 생겼는지 확인합니다.
   - 이제 VS Code를 켜고 `D:\git\scimanager` 폴더를 열어서 작업하면 됩니다.

---

이제 코드가 내 컴퓨터(`D:\git\scimanager`)에 준비되었습니다. 다음 단계인
**Supabase(데이터베이스)** 설정을 진행하세요.

---

## 3. Supabase (데이터베이스) 설정

이 프로젝트는 Supabase라는 클라우드 데이터베이스를 사용합니다. 새로운 사용자는
본인의 Supabase 프로젝트를 만들고 연결해야 합니다.

### 단계 1: Supabase 가입 및 프로젝트 생성

1. [Supabase](https://supabase.com/) 사이트에 접속하여 "Start your project"를
   눌러 가입합니다.
2. **"New Project"** 버튼을 누릅니다.
3. 다음 내용을 입력하고 **"Create new project"**를 누릅니다.
   - **Name**: `ScienceLab` (또는 원하는 이름)
   - **Database Password**: **[중요]** 비밀번호를 만들어 입력하고, **꼭
     기억해두세요.**
   - **Region**: `Seoul` (South Korea) 선택

### 단계 2: 주소와 키(Key) 복사하기

프로젝트가 생성되면(몇 분 걸릴 수 있음), API 정보를 복사해서 내 코드에 넣어야
합니다.

1. Supabase 대시보드 왼쪽 메뉴 맨 아래의 **Settings(톱니바퀴) > API** 를
   클릭합니다.
2. 다음 두 가지 값을 확인합니다.
   - **Project URL**: `https://...supabase.co` 형태
   - **Project API keys (anon public)**: `ey...` 로 시작하는 긴 문자열

### 단계 3: 내 코드에 적용하기

1. VS Code에서 `D:\git\scimanager` 폴더를 열어둔 상태에서, 왼쪽 파일 목록의
   **[js](file:///d:/Cloud/git/pogoksci/js) 폴더 >
   [supabaseClient.js](file:///d:/Cloud/git/pogoksci/js/supabaseClient.js)
   파일**을 클릭합니다.
2. 파일 내용 위쪽(약 9~11번째 줄)을 찾습니다.
   ```javascript
   const SUPABASE_URL = "여기에_Project_URL_붙여넣기";
   const SUPABASE_ANON_KEY = "여기에_anon_public_키_붙여넣기";
   ```
3. 기존 값 대신, 새로운 사용자의 Supabase에서 복사한 **본인의 URL과 Key**로
   바꿔치기합니다.
4. `Ctrl + S`를 눌러 저장합니다.

---

## 4. 데이터베이스 구조 만들기 (Schema 적용)

아직 데이터베이스가 비어있습니다. 기존 사용자가 만들어둔
DB구조([schema.sql](file:///d:/Cloud/git/pogoksci/schema.sql))를 그대로 적용해야
합니다.

1. VS Code에서 **[schema.sql](file:///d:/Cloud/git/pogoksci/schema.sql)** 파일을
   엽니다 (최상위 폴더에 있습니다).
2. 파일 내용을 **모두 선택(`Ctrl + A`)** 하고 **복사(`Ctrl + C`)** 합니다.
3. 다시 Supabase 대시보드 웹사이트로 돌아갑니다.
4. 왼쪽 메뉴에서 **SQL Editor** (터미널 아이콘)를 클릭합니다.
5. **New query** (빈 페이지)를 클릭합니다.
6. 복사한 내용을 붙여넣기(`Ctrl + V`) 하고, 오른쪽 아래 **"Run"** 버튼을
   누릅니다.
7. 아래쪽에 `Success` 메시지가 뜨면 성공입니다! (테이블들이 생성되었습니다)

---

## 5. 관리자 ID 만들기

1단계: Supabase 대시보드 UI에서 seed 유저 생성

Supabase 메뉴에서 Authentication -> Users로 들어갑니다. 오른쪽 상단의 [Add User]
-> **[Create new user]**를 클릭합니다.

1. Email: admin@goe.sci / Password:
2. Email: head@goe.sci / Password:
3. Email: teacher@goe.sci / Password:

(원하는 비밀번호) 을 입력합니다.

Auto-confirm User: 이 체크박스를 반드시 체크하고 [Create User]를 누릅니다.

2단계: 생성된 유저에게 역할 부여 (SQL)

-- 이미 존재하는 auth.users 유저들을 public.user_roles 테이블에 연결합니다.
INSERT INTO public.user_roles (user_id, email, role, status) SELECT id, email,
CASE WHEN email = 'admin@goe.sci' THEN 'admin' WHEN email = 'head@goe.sci' THEN
'head_teacher' WHEN email = 'teacher@goe.sci' THEN 'teacher' ELSE 'guest' END as
role, 'active' as status FROM auth.users WHERE email IN ('admin@goe.sci',
'head@goe.sci', 'teacher@goe.sci') ON CONFLICT (user_id) DO UPDATE SET role =
EXCLUDED.role, status = EXCLUDED.status; -- 결과 확인 SELECT * FROM
public.user_roles;

3단계: 확인! 이제 사이트에서 로그인을 시도해 보세요.

## 6. 웹사이트 실행하기

### 방법 1: VS Code "Live Server" 사용 (추천)

가장 안정적으로 실행하는 방법입니다. 확장 프로그램을 하나 설치해야 합니다.

1. VS Code 왼쪽 메뉴에서 **Extensions** (블럭 모양 아이콘)를 클릭합니다.
2. 검색창에 `Live Server`를 입력하고, **Live Server (Ritwick Dey)**를 찾아
   **Install**을 누릅니다.
3. 설치가 끝나면, 다시 파일 목록(Explorer)으로 돌아옵니다.
4. **[index.html](file:///d:/Cloud/git/pogoksci/index.html)** 파일 위에서
   **[마우스 우클릭] > "Open with Live Server"**를 선택합니다.
5. 브라우저가 열리면서 `http://127.0.0.1:5500/index.html` 주소로 사이트가
   실행됩니다.

수고하셨습니다! 이제 새로운 사용자의 과학실 관리 프로그램이 작동합니다.

---

## 7. 인터넷에 배포하기 (sdevbox.github.io)

내 컴퓨터뿐만 아니라, 다른 사람들도 접속할 수 있게 인터넷에 올리고 싶다면
**GitHub Pages**를 사용합니다. 새로운 사용자의 GitHub 아이디가 `myshcoolid`라고
가정하고 설명합니다.

### 단계 1: 새 저장소(Repository) 만들기

1. GitHub 웹사이트 로그인 후, 우측 상단 `+` 버튼을 눌러 **New repository**를
   선택합니다.
2. **Repository name**에 정확히 다음 이름을 입력합니다. (매우 중요!)
   - `myshcoolid.github.io`
   - (즉, `본인아이디.github.io`로 만들어야 합니다.)
3. `Public`으로 설정하고, 다른 체크박스는 건드리지 말고 **Create repository**를
   누릅니다.

### 단계 2: 내 코드를 새 저장소로 연결하기 (터미널)

지금 내 컴퓨터에 있는 코드는 선생님의 저장소(`pogoksci`)와 연결되어 있습니다.
이것을 끊고 방금 만든 내 저장소(`sdevbox`)로 연결해줘야 합니다. VS Code
터미널에서 다음 명령어들을 순서대로 한 줄씩 입력하세요.

1. **기존 연결 끊기**:
   ```bash
   git remote remove origin
   ```

2. **내 저장소 연결하기**:
   ```bash
   git remote add origin https://github.com/myschoolid/myschoolid.github.io.git
   ```

3. **코드 올리기 (Upload)**:
   ```bash
   git push -u origin main
   ```
   - (로그인 창이 뜨면 브라우저를 통해 로그인해주세요.)

### 단계 3: 접속 확인

약 1~2분 정도 기다린 후, 브라우저 주소창에 다음 주소를 입력해보세요.

- `https://myshcoolid.github.io`

이제 전 세계 어디서든 이 주소로 내 과학실 관리 프로그램에 접속할 수 있습니다!

---

## 8. [고급] 서버 기능 (화학 검색, 안전 정보 등) 설정하기

이 단계는 조금 어려울 수 있지만, **화학물질 검색, 안전 정보 연동** 기능을 쓰려면
꼭 필요합니다. Supabase의 **Edge Functions**라는 ‘서버 프로그램’을 배포해야
합니다.

### 1단계: API 키 준비하기 (Secret)

서버가 동작하려면 몇 가지 비밀키(Secret)가 필요합니다. 각 사이트를 방문하여 새로
발급받아야 합니다.

- `CAS_API_KEY`:
  [CAS Common Chemistry API](https://www.cas.org/services/commonchemistry-api)
- `KOSHA_API_KEY`: [한국산업안전보건공단 API](https://www.data.go.kr)
- `KREACH_API_KEY`: [한국환경공단 API](https://www.data.go.kr)

**[설정 방법]**

1. Supabase 대시보드에서 왼쪽 메뉴 **Settings (톱니바퀴) > Edge Functions** 로
   들어갑니다. (또는 Project Settings > Secrets)
2. **"Add new secret"** 버튼을 누릅니다.
3. 위 키 이름(`CAS_API_KEY` 등)을 **Name**에, 실제 비밀 키 값을 **Value**에
   입력하고 저장합니다.

### 2단계: Supabase CLI 설치 및 배포

이 과정은 **터미널**에서 명령어로 진행해야 합니다.

1. **Supabase CLI 설치** (Windows PowerShell)
   - 키보드에서 `Win` 키를 누르고 "PowerShell"을 검색하여 실행합니다.
   - **Scoop(패키지 관리자)**를 먼저 설치해야 합니다. (이미 있다면 건너뜀)
     ```powershell
     Set-ExecutionPolicy RemoteSigned -Scope CurrentUser # (Y를 눌러 승인)
     irm get.scoop.sh | iex
     ```
   - Scoop을 이용해 Supabase CLI를 설치합니다.
     ```powershell
     scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
     scoop install supabase
     ```

2. **로그인**: VS Code 터미널에서 다음 명령어를 입력합니다.
   ```bash
   supabase login
   ```
   (브라우저가 뜨면 로그인하고 토큰을 복사해 붙여넣으세요.)

3. **프로젝트 연결**: 내 Supabase 프로젝트와 내 컴퓨터를 연결합니다.
   - **Project ID 확인법**: Supabase 대시보드 주소
     `https://supabase.com/dashboard/project/abcde1234` 에서 `abcde1234` 부분이
     ID입니다.
   ```bash
   supabase link --project-ref [내_프로젝트_ID]
   ```
   (비밀번호를 물어보면 Supabase DB 비밀번호를 입력합니다.)

4. **함수 배포 (Deploy)**:
   ```bash
   supabase functions deploy
   ```
   - 완료되면 "Deployed Function..." 메시지가 뜹니다.

이제 모든 기능이 완벽하게 동작합니다!

---

## 9. 프로젝트 백업 및 전달 가이드 (관리자용)

이 섹션은 프로젝트 관리자가 현재 Supabase 프로젝트의 모든 구조와 데이터를
추출하여 다른 사람에게 전달하거나 백업할 때 사용하는 방법입니다.

### 9-1. 사전 준비

이미 **8. [고급] 서버 기능 설정하기**에서 Supabase CLI를 설치하고 로그인했다면
이 단계는 건너뛰어도 됩니다.

1. **Supabase CLI 설치 및 로그인**: (위 8단계 참고)
2. **프로젝트 링크**:
   ```bash
   supabase link --project-ref <your-project-id>
   ```

### 9-2. 데이터베이스 및 스키마 추출

Supabase CLI를 사용하여 데이터베이스의 구조(Schema)와 데이터를 SQL 파일로
추출합니다.

**전체 백업 명령어 (추천)**: `auth` 사용자 정보, `storage` 폴더 구조, `public`
데이터 등을 모두 포함합니다.

```bash
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  --schema "auth,storage,public" \
  -f full_backup.sql
```

- `[PASSWORD]`: DB 비밀번호
- `[PROJECT_REF]`: 프로젝트 ID
- **주의**: `auth`와 `storage` 스키마 복원 시 기존 시스템 테이블과 충돌할 수
  있으므로, 빈 프로젝트에 복원하거나 주의해서 실행해야 합니다.

### 9-3. 기타 요소 백업

- **Edge Functions**: `supabase/functions` 폴더를 압축(`zip`)하여 전달합니다.
  SQL에 포함되지 않습니다.
- **Storage 파일**: 실제 업로드된 파일들은 SQL에 포함되지 않습니다. 별도로
  다운로드하거나 스크립트를 이용해 백업해야 합니다.

### 9-4. 전달 패키지 구성 요약

다른 사람에게 프로젝트를 완벽하게 넘겨주려면 다음 파일들을 하나의 폴더에 담아
전달하세요.

1. `full_backup.sql` (전체 구조 및 데이터)
2. `supabase/functions/` (서버 기능 코드)
3. `supabase/config.toml` (프로젝트 설정)

**받는 사람의 복원 순서**:

1. 새 Supabase 프로젝트 생성 및 `supabase link`
2. DB 초기화 후 스키마/데이터 적용: `psql ... < full_backup.sql`
3. Edge Functions 배포: `supabase functions deploy`
