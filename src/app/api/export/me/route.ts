import { NextResponse } from "next/server";
import { AuthError, assertMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** DSGVO Art. 15/20: eigene Daten als JSON (ohne Kundenpreise/Firmenfinanzen) */
export async function GET() {
  let ctx;
  try {
    ctx = await assertMember();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: 401 });
    throw e;
  }
  const me = ctx.member.id;
  const [tasks, comments, entries, requests, consents, logins] = await Promise.all([
    ctx.supabase.from("tasks").select("id, title, description, address, due_date, status, fixed_pay_cents, accepted_at, rating, created_at").eq("assignee_id", me),
    ctx.supabase.from("task_comments").select("task_id, body, created_at").eq("author_id", me),
    ctx.supabase.from("time_entries").select("task_id, started_at, ended_at, rate_cents").eq("member_id", me),
    ctx.supabase.from("task_requests").select("title, description, address, status, created_at").eq("created_by", me),
    ctx.supabase.from("consents").select("kind, version, granted, created_at").eq("user_id", ctx.userId),
    ctx.supabase.from("login_events").select("kind, user_agent, created_at").eq("user_id", ctx.userId),
  ]);
  const body = {
    exported_at: new Date().toISOString(),
    profile: { ...ctx.member, user_id: undefined },
    firm: { name: ctx.firm.name },
    tasks: tasks.data ?? [],
    comments: comments.data ?? [],
    time_entries: entries.data ?? [],
    requests: requests.data ?? [],
    consents: consents.data ?? [],
    logins: logins.data ?? [],
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meine-daten_${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
