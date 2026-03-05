import { NextResponse } from "next/server";
import { Resend } from "resend";
import { auth, currentUser } from "@clerk/nextjs/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const email = user.emailAddresses[0]?.emailAddress;
  const firstName = user.firstName ?? "there";

  if (!email) return NextResponse.json({ error: "No email" }, { status: 400 });

  try {
    const { data, error } = await resend.emails.send({
      from: "Zenith <onboarding@resend.dev>",
      to: [email],
      subject: "Welcome to Zenith ✨",
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Zenith</title>
</head>
<body style="margin:0;padding:0;background:#1C0B10;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1C0B10;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-radius:24px;border:1px solid rgba(203,67,139,0.30);background:#200B12;overflow:hidden;">

          <!-- Header gradient bar -->
          <tr>
            <td style="height:5px;background:linear-gradient(90deg,#CB438B,#BF3556);"></td>
          </tr>

          <!-- Logo + brand -->
          <tr>
            <td align="center" style="padding:36px 36px 0;">
              <p style="margin:0;font-size:28px;font-weight:800;font-style:italic;color:#FFE5D0;letter-spacing:-0.5px;">
                Zenith ✨
              </p>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding:28px 36px 0;">
              <h1 style="margin:0;font-size:32px;font-weight:800;color:#FFE5D0;line-height:1.15;">
                Hey, ${firstName}! 🌸
              </h1>
              <h2 style="margin:10px 0 0;font-size:20px;font-weight:400;font-style:italic;color:#CB438B;">
                Welcome to your aesthetic study space.
              </h2>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 36px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#C9A595;">
                We're so glad you're here. Zenith is built for girls who grind — 
                a space to track your tasks, crush Pomodoro sessions, and watch your weekly wins stack up.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#C9A595;">
                Here's what's waiting for you inside:
              </p>

              <!-- Feature list -->
              <table width="100%" cellpadding="0" cellspacing="0">
                ${[
                  ["📋", "Task Manager", "Add tasks with deadlines and priorities. Stay on top of everything."],
                  ["🍅", "Pomodoro Timer", "25-minute focus sessions so you can actually get things done."],
                  ["📈", "Weekly Progress", "Track your study days and celebrate every win."],
                  ["💬", "Daily Quote", "A fresh dose of motivation every single day."],
                ].map(([icon, title, desc]) => `
                <tr>
                  <td style="padding:0 0 16px;">
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="40" valign="top" style="padding-top:2px;font-size:20px;">${icon}</td>
                        <td>
                          <p style="margin:0;font-size:14px;font-weight:700;color:#FFE5D0;">${title}</p>
                          <p style="margin:3px 0 0;font-size:13px;color:#C9A595;line-height:1.5;">${desc}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join("")}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:8px 36px 36px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard"
                style="display:inline-block;background:linear-gradient(135deg,#CB438B,#BF3556);color:#fff;font-size:15px;font-weight:800;text-decoration:none;border-radius:16px;padding:14px 36px;letter-spacing:0.3px;">
                Open My Dashboard →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px;border-top:1px solid rgba(203,67,139,0.15);">
              <p style="margin:0;font-size:12px;color:rgba(201,165,149,0.55);text-align:center;line-height:1.6;">
                You're receiving this because you just signed up for Zenith.<br/>
                Made with 💕 for girlies who grind.
              </p>
            </td>
          </tr>

          <!-- Bottom gradient bar -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#BF3556,#CB438B);"></td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    if (error) throw error;
    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    console.error("[send-welcome]", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
