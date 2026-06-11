export const metadata = { title: "개인정보 처리방침 · fanarena.kr" };

export default function PrivacyPage() {
  return (
    <div className="bg-white rounded-lg border p-6 leading-relaxed text-sm text-gray-800">
      <h1 className="text-xl font-bold mb-1">개인정보 처리방침</h1>
      {/* TODO: 시행일자를 실제 날짜로 변경하세요 */}
      <p className="text-gray-500 mb-6">시행일: 2026-06-10</p>

      <p className="mb-6">
        fanarena.kr(이하 “서비스”)은 「개인정보 보호법」 등 관련 법령을 준수하며, 이용자의 개인정보를
        다음과 같이 처리합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목 및 방법">
        <p>서비스는 회원가입 및 이용 과정에서 아래 정보를 수집합니다.</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>필수: 아이디, 닉네임, 비밀번호(암호화 저장)</li>
          <li>이용 과정에서 자동 생성·수집: 접속 IP, 접속 기록, 브라우저·기기 정보, 쿠키</li>
          <li>이용자가 작성한 콘텐츠: 평점, 코멘트, 답글</li>
        </ul>
        <p className="mt-2">수집 방법: 회원가입 및 서비스 이용 시 이용자가 직접 입력하거나 자동으로 생성됩니다.</p>
      </Section>

      <Section title="2. 개인정보의 이용 목적">
        <ul className="list-disc pl-5 space-y-1">
          <li>회원 식별 및 로그인·인증, 회원 관리</li>
          <li>평점·코멘트 등 서비스 기능 제공 및 작성자 표시(닉네임)</li>
          <li>부정 이용 방지, 서비스 안정성 확보 및 문의 대응</li>
        </ul>
      </Section>

      <Section title="3. 보유 및 이용 기간">
        <p>
          이용자의 개인정보는 원칙적으로 회원 탈퇴 시 지체 없이 파기합니다. 다만 관련 법령에 따라
          보존이 필요한 경우 해당 기간 동안 보관하며, 작성한 게시물(평점·코멘트 등)은 탈퇴 후에도
          닉네임이 비식별 처리된 형태로 남을 수 있습니다.
        </p>
      </Section>

      <Section title="4. 개인정보의 제3자 제공">
        <p>서비스는 이용자의 개인정보를 외부에 제공하지 않습니다. 다만 법령에 따라 요구되는 경우는 예외로 합니다.</p>
      </Section>

      <Section title="5. 개인정보 처리의 위탁 및 국외 이전">
        <p>서비스는 안정적 운영을 위해 아래 해외 사업자의 인프라를 이용하며, 이 과정에서 개인정보가 국외에 저장·처리될 수 있습니다.</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Vercel Inc. (미국) — 웹 호스팅 및 서비스 운영</li>
          <li>Neon Inc. / Amazon Web Services (미국·싱가포르 리전) — 데이터베이스 저장</li>
        </ul>
        <p className="mt-2">이전 항목: 위 1항의 수집 정보. 이전 목적: 서비스 제공. 보유 기간: 회원 탈퇴 또는 위탁 종료 시까지.</p>
      </Section>

      <Section title="6. 개인정보의 파기">
        <p>보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다. 전자적 파일은 복구할 수 없는 방법으로 삭제합니다.</p>
      </Section>

      <Section title="7. 이용자의 권리와 행사 방법">
        <p>이용자는 언제든지 본인의 개인정보를 열람·정정·삭제하거나 처리 정지를 요구할 수 있으며, 회원 탈퇴를 통해 개인정보 삭제를 요청할 수 있습니다. 요청은 아래 연락처로 접수할 수 있습니다.</p>
      </Section>

      <Section title="8. 쿠키의 사용">
        <p>서비스는 로그인 상태 유지를 위해 쿠키(세션)를 사용합니다. 이용자는 브라우저 설정에서 쿠키 저장을 거부할 수 있으나, 이 경우 로그인 등 일부 기능이 제한될 수 있습니다.</p>
      </Section>

      <Section title="9. 개인정보의 안전성 확보 조치">
        <p>비밀번호는 복호화가 불가능한 방식으로 암호화하여 저장하며, 데이터 전송 구간은 HTTPS로 암호화됩니다. 접근 권한을 최소한으로 관리합니다.</p>
      </Section>

      <Section title="10. 개인정보 보호책임자">
        {/* TODO: 책임자 이름과 연락 이메일을 채우세요 */}
        <ul className="list-disc pl-5 space-y-1">
          <li>책임자: fanarena.kr 관리자</li>
          <li>연락처(이메일): fanarenakr@gmail.com</li>
        </ul>
        <p className="mt-2">개인정보 관련 문의·불만·피해구제는 위 연락처로 접수해 주시기 바랍니다.</p>
      </Section>

      <Section title="11. 고지 의무">
        <p>본 방침의 내용이 변경되는 경우 시행일 및 변경 사항을 서비스 화면에 공지합니다.</p>
      </Section>

      <p className="text-gray-500 mt-6">부칙: 본 방침은 2026-06-10부터 시행합니다.</p>
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
