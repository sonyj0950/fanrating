export const metadata = { title: "이용약관 · fanarena.kr" };

export default function TermsPage() {
  return (
    <div className="bg-white rounded-lg border p-6 leading-relaxed text-sm text-gray-800">
      <h1 className="text-xl font-bold mb-1">이용약관 및 운영정책</h1>
      {/* TODO: 시행일자 변경 */}
      <p className="text-gray-500 mb-6">시행일: [2026-06-10]</p>

      <Section title="제1조 (목적)">
        <p>본 약관은 fanarena.kr(이하 “서비스”)이 제공하는 스포츠 선수 평점·코멘트 서비스의 이용 조건 및 절차, 이용자와 서비스의 권리·의무를 규정함을 목적으로 합니다.</p>
      </Section>

      <Section title="제2조 (서비스의 성격)">
        <p>본 서비스는 이용자가 자발적으로 작성하는 평점과 의견을 공유하는 비공식 팬 커뮤니티입니다. 서비스는 KBO, 한국프로축구연맹, LCK 및 각 구단·선수와 아무런 제휴·후원·대표 관계가 없습니다. 게시된 평점·의견은 작성자 개인의 견해이며 서비스의 공식 입장이 아닙니다.</p>
      </Section>

      <Section title="제3조 (회원가입 및 계정)">
        <ul className="list-disc pl-5 space-y-1">
          <li>이용자는 아이디·닉네임·비밀번호를 등록하여 회원가입할 수 있습니다.</li>
          <li>만 14세 미만 아동은 법정대리인의 동의가 있어야 가입할 수 있습니다.</li>
          <li>타인의 정보를 도용하거나 허위 정보를 등록해서는 안 됩니다.</li>
          <li>계정 관리 책임은 이용자 본인에게 있습니다.</li>
        </ul>
      </Section>

      <Section title="제4조 (금지 행위)">
        <p>이용자는 다음 행위를 해서는 안 되며, 위반 시 게시물 삭제·블라인드 또는 이용 제한이 될 수 있습니다.</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>특정인(선수·감독·심판 등 포함)에 대한 욕설, 비방, 모욕, 명예훼손</li>
          <li>허위사실 유포, 차별·혐오 표현, 성적·폭력적 표현</li>
          <li>도배, 스팸, 광고, 동일 내용 반복 게시</li>
          <li>타인의 개인정보·초상 무단 게시, 저작권 등 타인의 권리 침해</li>
          <li>다중 계정을 이용한 평점 조작 등 서비스 운영 방해</li>
        </ul>
      </Section>

      <Section title="제5조 (게시물의 관리)">
        <ul className="list-disc pl-5 space-y-1">
          <li>이용자는 부적절한 게시물을 신고할 수 있으며, 신고가 누적되면 해당 게시물은 자동으로 블라인드 처리될 수 있습니다.</li>
          <li>운영자는 제4조를 위반하거나 권리 침해 신고가 접수된 게시물을 사전 통지 없이 블라인드 또는 삭제할 수 있습니다.</li>
          <li>게시물의 권리와 책임은 작성자에게 있습니다.</li>
        </ul>
      </Section>

      <Section title="제6조 (책임의 제한)">
        <p>서비스는 이용자가 게시한 내용의 정확성·신뢰성을 보증하지 않으며, 이용자 간 또는 이용자와 제3자 간에 게시물로 인해 발생한 분쟁에 대해 법령이 허용하는 범위에서 책임을 지지 않습니다. 다만 운영자가 신고 등에 따라 필요한 조치를 취하지 않은 경우는 예외로 합니다.</p>
      </Section>

      <Section title="제7조 (약관의 변경)">
        <p>본 약관은 관련 법령에 위배되지 않는 범위에서 변경될 수 있으며, 변경 시 시행일과 내용을 서비스 화면에 공지합니다.</p>
      </Section>

      <p className="text-gray-500 mt-6">부칙: 본 약관은 [2026-06-10]부터 시행합니다.</p>
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
