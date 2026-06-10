[OG 이미지 — 카톡·인스타까지 보이게 설정 (v2.3)]

카톡/인스타는 이미지에 절대경로(전체 URL)가 명시돼야 썸네일을 띄웁니다.
그래서 PNG를 public 폴더에 og.png 로 두고, 메타데이터에서 직접 지정했습니다.

▶ 해야 할 일 (딱 두 가지):

1) 기존에 app/opengraph-image.png 로 넣었던 그 흰 카드 PNG를
   → public/og.png  로 복사 (또는 이동)해서 넣으세요.
   (public 폴더가 없으면 app 과 같은 위치에 새로 만드세요)

2) app/opengraph-image.png 는 삭제하세요.
   (두 개가 있으면 OG 태그가 둘이 되어 카톡이 헷갈립니다. public/og.png 하나만 남깁니다)

그 후:
   git add .
   git commit -m "og image to public/og.png"
   git push

확인:
   브라우저에서  https://fanarena.kr/og.png  → 흰 카드가 떠야 정상.

※ 카톡은 캐시가 강합니다. 적용 후에도 기존 링크는 옛 이미지가 남을 수 있어요.
  카카오 '카카오톡 공유 디버거'(https://developers.kakao.com/tool/debugger/sharing)에
  링크를 넣고 '캐시 삭제' 를 누르면 즉시 갱신됩니다.
