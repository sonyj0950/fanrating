# 🏟️ fan.arena (v0.6)

fan.arena — 야구(KBO) · 축구(K리그) · LCK 팬 평점 아레나. Next.js 14 (App Router) + Prisma(SQLite) + NextAuth.

## 실행 방법

```bash
npm install
cp .env.example .env        # NEXTAUTH_SECRET 값을 변경하세요 (openssl rand -base64 32)
npx prisma migrate dev -n init
npm run dev                 # http://localhost:3000
```

**첫 번째로 가입한 계정이 자동으로 관리자(admin)가 됩니다.**
가입 후 우측 상단 "관리자" 메뉴에서 경기를 등록하세요.

## 기능

- 홈: 🔥 오늘의 경기 / 📅 예정된 경기 / 🗂 이전의 경기
- 로그인: 아이디 + 비밀번호 + 닉네임(사이트 표시명, 중복 불가)
- 경기 등록(관리자): 선수 명단을 줄 단위로 입력 — `이름,팀,포지션,역할,우선순위(P)`
- 종목별 화면: 야구(우선 선수 + 더보기), 축구(포지션 차트 기반 피치 배치), LCK(라인업)
- 평점: 세그먼트별(전/후반, 세트) 2~9점, 유저당 1회(재등록 시 갱신), POG/POM 자동 선정
- **골·어시스트 기록**: 경기 페이지 날짜 아래, 관리자가 줄 단위로 입력/수정 ⚽
- **코멘트 선택화**: 평점만 등록 가능, 코멘트 작성 시에만 10자 규칙 적용
- **대댓글**: 코멘트마다 💬 답글 작성 가능 (로그인 필요)
- **경기 삭제**: 관리자에게만 🗑 버튼 표시 (홈 카드 + 경기 페이지), 평점·코멘트 연쇄 삭제
- 코멘트 좋아요(토글) + 인기 코멘트 상단 고정
- 축구: 전반/후반 선수 구성 분리(관리자 "전/후반 명단 관리"에서 변경), 후반 탭은 진영이 전반과 반대로 표시(총평은 전반 기준)
- 축구: 감독/코치는 필드 양 사이드, 심판은 필드 아래에 표시 — 모두 평점 가능
- 포지션 코드가 없는 선수는 "후보/교체"로 표시

## 축구 포지션 코드

`lib/soccerPositions.ts`에 정의 (포지션 차트 기준 29개):

| 라인 | 코드 |
|---|---|
| 스트라이커 | LS · ST · RS |
| 세컨톱 | SS |
| 포워드 | LW · LCF · CF · RCF · RW |
| 공격형 MF | LAM · AM · RAM |
| 중앙 MF | LM · LCM · CM · RCM · RM |
| 수비형 MF | LWB · LDM · DM · RDM · RWB |
| 수비 | LB · LCB · CB · RCB · RB |
| 스위퍼 / 골키퍼 | SW / GK |

코드 대신 "공격수/미드필더/수비수/골키퍼" 같은 한글 입력도 자동 인식됩니다.

## 구조

```
app/
  page.tsx                     홈 (경기 목록 + 삭제)
  login/page.tsx               로그인/회원가입
  admin/                       경기 등록 (관리자)
  [sport]/[matchId]/           경기 상세 (평점/기록/코멘트)
    SoccerField.tsx            축구 피치
    BaseballField.tsx          야구 카드
    LckLineup.tsx              LCK 라인업
  api/                         REST 라우트
lib/                           prisma, auth, soccerPositions
components/                    Header, DeleteMatchButton
prisma/schema.prisma           DB 스키마
```

## PostgreSQL로 전환하려면

`prisma/schema.prisma`의 `datasource`를 `provider = "postgresql"`로 바꾸고
`DATABASE_URL`을 교체한 뒤 `npx prisma migrate dev` 재실행.

## 배포 (Vercel + Neon)

1. **DB**: https://neon.tech 가입 → 프로젝트 생성 → 연결 문자열(DATABASE_URL) 복사
2. **GitHub**: 이 폴더를 저장소로 푸시
3. **Vercel**: https://vercel.com 에서 New Project → 저장소 import
   - Environment Variables: `DATABASE_URL`(Neon 값), `NEXTAUTH_SECRET`(openssl rand -base64 32)
   - 빌드 시 `prisma db push`가 자동 실행되어 테이블이 생성됩니다
4. 배포된 주소(예: fanarena.vercel.app)에 접속 → 첫 가입 = 관리자

### 커스텀 도메인
`.arena`라는 최상위 도메인(TLD)은 존재하지 않아 `fan.arena` 자체는 등록할 수 없습니다.
대신 `fanarena.com` / `fan-arena.com` / `fanarena.kr` / `fanarena.gg` 등을
가비아·Cloudflare·Namecheap 등에서 구매한 뒤,
Vercel 프로젝트 → Settings → Domains에서 추가하고 안내되는 DNS 레코드(A/CNAME)를 등록하면 됩니다.

## v0.8 추가
- 코멘트 신고(🚩) — 로그인 유저, 코멘트당 1회, 신고 3건 누적 시 자동 블라인드
- 관리자 코멘트 블라인드/복구/삭제
- 코멘트 최소 글자수 5자로 통일, 자음·모음만 작성 차단(서버 검증)

※ 스키마 변경: Rating.blinded, Report 모델 추가 → 배포 시 `prisma db push` 필요
