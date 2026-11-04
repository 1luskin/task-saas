import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { runReviewJobs } from "@/server/jobs/review";
import { runShiftJobs } from "@/server/jobs/shifts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Häufige Jobs (alle 15 min) – aufgerufen von Supabase pg_cron + pg_net
 * (siehe Migration 20261104000004_frequent_cron.sql und README).
 * Vercel Hobby erlaubt nur tägliche Crons, daher dieser zweite Weg.
 */
async function handle(req: Request) {
  const secret = serverEnv().CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [review, shifts] = await Promise.all([runReviewJobs(), runShiftJobs()]);
  return NextResponse.json({ ok: true, review, shifts });
}

export const GET = handle;
export const POST = handle;
