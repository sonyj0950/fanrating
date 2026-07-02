// 이메일 발송 (Resend). RESEND_API_KEY가 없으면 콘솔에 링크를 출력하고 넘어간다.
// → 키 발급 전(로컬/미설정)에도 앱이 죽지 않고, 개발 중엔 콘솔에서 링크를 눌러 테스트 가능.
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
// 도메인 인증 전이면 Resend 테스트 발신주소(onboarding@resend.dev)를 기본값으로 사용.
const FROM = process.env.EMAIL_FROM || "Fan Arena <onboarding@resend.dev>";
const resend = apiKey ? new Resend(apiKey) : null;

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    // 개발/미설정 폴백: 실제로 보내지 않고 콘솔에 남긴다.
    console.log(`\n[email:dev] TO=${to}\nSUBJECT=${subject}\n${html}\n`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (e) {
    console.error("[email] 발송 실패:", e);
  }
}

function layout(title: string, body: string) {
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#222">
    <h2 style="margin:0 0 16px">${title}</h2>
    ${body}
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee" />
    <p style="font-size:12px;color:#999">본 메일은 fanarena.kr에서 발송되었습니다. 요청하지 않았다면 무시하세요.</p>
  </div>`;
}

function button(href: string, label: string) {
  return `<p style="margin:20px 0">
    <a href="${href}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">${label}</a>
  </p>
  <p style="font-size:13px;color:#666">버튼이 안 되면 아래 주소를 복사해 접속하세요:<br/><span style="word-break:break-all">${href}</span></p>`;
}

export async function sendVerificationEmail(to: string, link: string) {
  await send(
    to,
    "[Fan Arena] 이메일 인증을 완료해 주세요",
    layout("이메일 인증", `<p>아래 버튼을 눌러 이메일 인증을 완료하면 평점·코멘트 작성이 가능합니다. (링크는 24시간 유효)</p>${button(link, "이메일 인증하기")}`)
  );
}

export async function sendPasswordResetEmail(to: string, link: string) {
  await send(
    to,
    "[Fan Arena] 비밀번호 재설정 안내",
    layout("비밀번호 재설정", `<p>아래 버튼을 눌러 새 비밀번호를 설정하세요. (링크는 1시간 유효)<br/>본인이 요청하지 않았다면 이 메일을 무시하시면 됩니다.</p>${button(link, "비밀번호 재설정")}`)
  );
}
