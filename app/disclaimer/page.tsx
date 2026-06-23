export const metadata = { title: "면책 조항 · fanarena.kr" };

export default function DisclaimerPage() {
  return (
    <div className="bg-white rounded-lg border p-6 leading-relaxed text-sm text-gray-800">
      <h1 className="text-xl font-bold mb-1">면책 조항 (Disclaimer)</h1>
      <p className="text-gray-500 mb-6">시행일: 2026-06-24</p>

      <p className="mb-6">
        fanarena.kr(이하 “서비스”)은 야구·축구·e스포츠 경기에 대한 팬들의 평점과 의견을 나누기 위한
        독립된 팬 커뮤니티입니다. 서비스 이용 전 아래 내용을 확인해 주시기 바랍니다.
      </p>

      <Section title="1. 비공식·비제휴 고지">
        <p>
          서비스는 KBO·한국야구위원회, 한국프로축구연맹(K리그), 라이엇 게임즈(Riot Games)·LCK,
          그 밖의 어떠한 리그·구단·선수·단체와도 제휴, 후원, 보증, 위탁 등의 공식적인 관계가 없는
          비공식 팬 사이트입니다. 서비스의 어떠한 내용도 위 단체들의 공식 입장을 대변하지 않습니다.
        </p>
      </Section>

      <Section title="2. 상표 및 저작권">
        <p>
          서비스에 표기되는 팀명, 선수명, 리그명, 챔피언명 등은 각 권리자의 상표 또는 저작물이며,
          이는 경기를 식별하기 위한 사실적·지명적 인용에 한합니다. 서비스는 각 단체의 공식 로고·엠블럼,
          중계 영상, 기타 보호되는 이미지 자산을 사용하지 않습니다. 모든 권리는 각 권리자에게 있습니다.
        </p>
      </Section>

      <Section title="3. 데이터의 출처와 정확성">
        <p>
          경기 결과, 라인업, 선수 정보 등은 운영자가 직접 정리·입력한 사실 정보입니다. 서비스는 데이터의
          정확성·완전성을 보장하지 않으며, 오류가 있을 수 있습니다. 평점·코멘트는 이용자 개인의 의견으로
          서비스의 견해가 아닙니다. 정정이 필요한 내용은 아래 연락처로 알려 주시면 검토합니다.
        </p>
      </Section>

      <Section title="4. League of Legends / Riot Games 관련 고지">
        <p>
          서비스의 LCK 관련 콘텐츠는 라이엇 게임즈가 공식적으로 후원·보증하지 않으며, 라이엇 게임즈 또는
          관련 제작·운영 주체의 견해를 반영하지 않습니다. League of Legends 및 관련 자산은 라이엇 게임즈의
          상표 또는 등록상표입니다.
        </p>
        <p className="mt-2 text-gray-500">
          fanarena.kr isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games
          or anyone officially involved in producing or managing Riot Games properties. Riot Games and all
          associated properties are trademarks or registered trademarks of Riot Games, Inc.
        </p>
      </Section>

      <Section title="5. 광고 및 후원">
        <p>
          서비스는 운영비 충당을 위해 일부 영역에 광고를 게재하거나 이용자의 자발적 후원을 받을 수 있습니다.
          후원금은 서버·도메인 등 서비스 운영 비용에 사용됩니다. 광고·후원의 유무가 위 1~4항의 비공식·비제휴
          및 권리 귀속에 영향을 주지 않습니다.
        </p>
      </Section>

      <Section title="6. 책임의 한계">
        <p>
          서비스는 무료로 제공되며, 서비스 이용 또는 게시 정보로 인해 발생한 직접·간접적 손해에 대해 법령이
          허용하는 범위에서 책임을 지지 않습니다. 권리자의 정당한 요청이 있을 경우 해당 콘텐츠를 신속히 수정·삭제합니다.
        </p>
      </Section>

      <Section title="7. 문의">
        <ul className="list-disc pl-5 space-y-1">
          <li>연락처(이메일): fanarenakr@gmail.com</li>
        </ul>
        <p className="mt-2">권리 침해 신고, 데이터 정정, 기타 문의는 위 연락처로 접수해 주시기 바랍니다.</p>
      </Section>

      <p className="text-gray-500 mt-6">본 면책 조항은 2026-06-24부터 시행합니다.</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="font-semibold mb-1">{title}</h2>
      <div className="text-gray-700">{children}</div>
    </section>
  );
}
