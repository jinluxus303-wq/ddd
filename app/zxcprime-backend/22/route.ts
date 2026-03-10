import { NextRequest, NextResponse } from "next/server";
import { validateBackendToken } from "@/lib/validate-token";
import { searchFebboxShareLink } from "@/lib/febbox-search";

const WORKER_URL = "https://main.jinluxuz.workers.dev";
const WORKER_SECRET = "xk92mZpQ7vLw3nRt";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const tmdbId = searchParams.get("a");
    const mediaType = searchParams.get("b");
    const season = searchParams.get("c");
    const episode = searchParams.get("d");
    const title = searchParams.get("f");
    const year = searchParams.get("g");
    const ts = Number(searchParams.get("gago"));
    const token = searchParams.get("putanginamo")!;
    const f_token = searchParams.get("f_token")!;

    if (!tmdbId || !mediaType || !title || !year || !ts || !token)
      return NextResponse.json(
        { success: false, error: "Missing params" },
        { status: 400 },
      );

    if (Date.now() - ts > 8000)
      return NextResponse.json(
        { success: false, error: "Token expired" },
        { status: 403 },
      );

    if (!validateBackendToken(tmdbId, f_token, ts, token))
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 403 },
      );

    // STEP 1 — Next.js handles search
    const shareLink = await searchFebboxShareLink(title, year);
    if (!shareLink)
      return NextResponse.json(
        { success: false, error: "No FebBox share link found" },
        { status: 502 },
      );

    const shareToken = shareLink.split("/share/")[1];
    if (!shareToken)
      return NextResponse.json(
        { success: false, error: "Could not parse share token" },
        { status: 500 },
      );

    // STEPS 2 & 3 — worker handles the rest
    const qs = new URLSearchParams({
      secret: WORKER_SECRET,
      shareToken,
      mediaType,
      ...(season && { season }),
      ...(episode && { episode }),
    });

    const workerRes = await fetch(`${WORKER_URL}/?${qs}`);
    const data = await workerRes.json();

    return NextResponse.json(data, { status: workerRes.status });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
