[OG 이미지 적용 안내 — B방식 / PNG]

1. app/og-card-source.svg 를 PNG로 변환:
   - https://cloudconvert.com/svg-to-png 에 업로드
   - Width 1200, Height 630 으로 지정
   - 변환 후 파일명을 정확히  opengraph-image.png  로 저장

2. 그 PNG를 app/ 폴더에 넣기 (app/opengraph-image.png)

3. git add . / commit / push

→ Next.js가 app/opengraph-image.png 를 사이트 전체의 기본 OG 이미지로 자동 적용합니다.
  (홈, 경기, 내 평점 등 모든 링크 공유 시 이 카드가 뜸)

※ 동적 OG 카드(.tsx)는 제거되었습니다.
