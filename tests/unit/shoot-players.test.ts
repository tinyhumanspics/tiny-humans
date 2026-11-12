import { describe, expect, test, vi } from "vitest";
import { contentSecurityPolicy } from "@/lib/security/csp";
import { expandVideoLink } from "@/lib/shoots/expand-link";
import { hopAllowed, isShortVideoLink, PLAYER_ORIGINS, playerOf, playsHere, startSeconds } from "@/lib/shoots/players";

vi.mock("server-only", () => ({}));

/** /admin → Shoots: pasted videos play inside the sheet (owner, Nov 11). */
describe("shoots: videos that play here", () => {
  test("Instagram posts and reels (also after the account name) → Instagram's embed", () => {
    expect(playerOf("https://www.instagram.com/reel/DLHx_WNoXoY/?igsh=MWx0b2Q")).toEqual({ src: "https://www.instagram.com/reel/DLHx_WNoXoY/embed/", shape: "post" });
    expect(playerOf("instagram.com/reels/DLHx_WNoXoY")).toEqual({ src: "https://www.instagram.com/reel/DLHx_WNoXoY/embed/", shape: "post" });
    expect(playerOf("https://www.instagram.com/p/C08-b3uM0U9/?img_index=2")?.src).toBe("https://www.instagram.com/p/C08-b3uM0U9/embed/");
    expect(playerOf("https://www.instagram.com/maria.photo/reel/DLHx_WNoXoY/")?.src).toBe("https://www.instagram.com/reel/DLHx_WNoXoY/embed/");
    expect(playerOf("https://www.instagram.com/tv/CAbcdef12/")?.src).toBe("https://www.instagram.com/p/CAbcdef12/embed/");
    // profiles, stories and odd codes keep opening the link
    expect(playerOf("https://www.instagram.com/tinyhumans.photography/")).toBeNull();
    expect(playerOf("https://www.instagram.com/stories/maria/3412345678901234567/")).toBeNull();
    expect(playerOf("https://www.instagram.com/reel/abc/")).toBeNull();
    expect(playerOf("https://www.instagram.com/reel/<script>/")).toBeNull();
  });

  test("TikTok videos → TikTok's embed player (no related videos)", () => {
    const player = { src: "https://www.tiktok.com/player/v1/7301234567890123456?rel=0", shape: "tall" };
    expect(playerOf("https://www.tiktok.com/@maria/video/7301234567890123456?is_from_webapp=1&sender_device=pc")).toEqual(player);
    expect(playerOf("tiktok.com/@maria/photo/7301234567890123456")).toEqual(player);
    expect(playerOf("https://m.tiktok.com/v/7301234567890123456.html")).toEqual(player);
    expect(playerOf("https://www.tiktok.com/embed/v2/7301234567890123456")).toEqual(player);
    expect(playerOf("https://www.tiktok.com/@maria")).toBeNull();
    expect(playerOf("https://www.tiktok.com/@maria/video/notanumber")).toBeNull();
  });

  test("YouTube (watch, youtu.be, Shorts, live, start time) and Vimeo", () => {
    expect(playerOf("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x")).toEqual({ src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0", shape: "wide" });
    expect(playerOf("https://youtu.be/dQw4w9WgXcQ?t=90")?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0&start=90");
    expect(playerOf("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s")?.src).toContain("start=90");
    expect(playerOf("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toEqual({ src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0", shape: "tall" });
    expect(playerOf("https://www.youtube.com/live/dQw4w9WgXcQ")?.shape).toBe("wide");
    expect(playerOf("https://www.youtube.com/@channel")).toBeNull();
    expect(playerOf("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(playerOf("https://vimeo.com/76979871")).toEqual({ src: "https://player.vimeo.com/video/76979871", shape: "wide" });
    expect(playerOf("https://vimeo.com/76979871/a1b2c3d4e5")?.src).toBe("https://player.vimeo.com/video/76979871?h=a1b2c3d4e5");
    expect(startSeconds("1h2m3s")).toBe(3723);
    expect(startSeconds("abc")).toBe(0);
  });

  test("Pinterest, Facebook, other sites and bad links keep opening the link", () => {
    for (const link of ["https://www.pinterest.com/pin/99360735500167749/", "https://pin.it/1abcDEF", "https://www.facebook.com/reel/123456789", "https://example.com/video/1", "javascript:alert(1)", ""]) {
      expect(playsHere(link)).toBe(false);
    }
    expect(playsHere(null)).toBe(false);
  });

  test("short share links are opened on the server first", () => {
    for (const link of ["https://vm.tiktok.com/ZMh1abcDE/", "https://vt.tiktok.com/ZSabc123/", "https://www.tiktok.com/t/ZThabcdEF/", "https://www.instagram.com/share/reel/BAabcdEFG"]) {
      expect(isShortVideoLink(link)).toBe(true);
      expect(playsHere(link)).toBe(true);
    }
    expect(isShortVideoLink("https://vm.tiktok.com/")).toBe(false);
    expect(isShortVideoLink("https://www.tiktok.com/@maria/video/7301234567890123456")).toBe(false);
    expect(hopAllowed(new URL("https://www.tiktok.com/@maria/video/1"))).toBe(true);
    for (const bad of ["http://www.tiktok.com/a", "https://evil.example/a", "https://tiktok.com.evil.example/a", "https://www.tiktok.com:8443/a", "https://u:p@www.tiktok.com/a", "https://169.254.169.254/latest"]) {
      expect(hopAllowed(new URL(bad))).toBe(false);
    }
  });

  test("the site lets each app's player load (Content-Security-Policy frame-src)", () => {
    const frameSrc = contentSecurityPolicy().split("; ").find((d) => d.startsWith("frame-src "))!;
    for (const origin of PLAYER_ORIGINS) expect(frameSrc.split(" ")).toContain(origin);
  });
});

describe("shoots: opening a short link", () => {
  const redirect = (to: string, status = 302) => new Response(null, { status, headers: { location: to } });

  test("follows TikTok's redirects to the video, without reading pages", async () => {
    const asked: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      asked.push(String(input));
      expect(init?.redirect).toBe("manual");
      return asked.length === 1 ? redirect("https://www.tiktok.com/t/ZT2/") : redirect("/@maria/video/7301234567890123456?_r=1", 301);
    });
    expect(await expandVideoLink("vm.tiktok.com/ZMh1abcDE/", fetcher as typeof fetch)).toEqual({ src: "https://www.tiktok.com/player/v1/7301234567890123456?rel=0", shape: "tall" });
    expect(asked).toEqual(["https://vm.tiktok.com/ZMh1abcDE/", "https://www.tiktok.com/t/ZT2/"]);
  });

  test("a removed video, a page instead of a redirect, another site, a loop or no answer → can't play here", async () => {
    expect(await expandVideoLink("https://vm.tiktok.com/ZMgone/", (async () => redirect("https://www.tiktok.com/?_r=1")) as unknown as typeof fetch)).toBeNull();
    expect(await expandVideoLink("https://www.instagram.com/share/reel/BAx", (async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch)).toBeNull();
    const evil = vi.fn(async () => redirect("http://169.254.169.254/latest/meta-data"));
    expect(await expandVideoLink("https://vm.tiktok.com/ZMevil/", evil as unknown as typeof fetch)).toBeNull();
    expect(evil).toHaveBeenCalledTimes(1);
    const loop = vi.fn(async () => redirect("https://vm.tiktok.com/ZMloop/"));
    expect(await expandVideoLink("https://vm.tiktok.com/ZMloop/", loop as unknown as typeof fetch)).toBeNull();
    expect(loop).toHaveBeenCalledTimes(5);
    expect(await expandVideoLink("https://vm.tiktok.com/ZMdown/", (async () => { throw new Error("timeout"); }) as unknown as typeof fetch)).toBeNull();
  });

  test("full links and other sites never call out", async () => {
    const fetcher = vi.fn();
    expect(await expandVideoLink("https://www.instagram.com/reel/DLHx_WNoXoY/", fetcher as unknown as typeof fetch)).toEqual({ src: "https://www.instagram.com/reel/DLHx_WNoXoY/embed/", shape: "post" });
    expect(await expandVideoLink("https://example.com/a", fetcher as unknown as typeof fetch)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
