import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * App.jsx (정리/수정판)
 * - 로그인: asd/asd
 * - 탭: 영상(file/hls) / 유튜브
 * - 플레이어: <video> 또는 YouTube IFrame API
 * - 자동 다음/반복 재생 (유튜브 포함)
 * - 반응형: 모바일 1열, 큰 화면 2열, 전체 폭 대응
 */

// --- 환경별 BASE_URL 안전 추출 ---
function getBaseUrl(metaObj) {
    try {
        const m = metaObj || import.meta;
        const env = m && m.env ? m.env : {};
        const val = typeof env.BASE_URL === "string" ? env.BASE_URL : null;
        return val && val.length > 0 ? val : "/";
    } catch {
        return "/";
    }
}
const PLAYLIST_URL = `${getBaseUrl()}playlist.json`;

// --- 다음 재생 아이디 계산 (옵셔널 체이닝/널 병합 미사용 버전) ---
export function computeNextId(list, currentId, opts) {
    const cfg = opts || {};
    const repeatOne = !!cfg.repeatOne;
    const autoNext = !!cfg.autoNext;
    if (!Array.isArray(list) || list.length === 0) return null;
    const idx = list.findIndex((v) => v && v.id === currentId);
    if (repeatOne) {
        return currentId !== undefined && currentId !== null
            ? currentId
            : (list[0] ? list[0].id : null);
    }
    if (!autoNext) return null;
    if (idx === -1) return list[0] ? list[0].id : null;
    if (idx < list.length - 1) return list[idx + 1] ? list[idx + 1].id : null;
    return null; // 마지막에서는 정지(루프 없음)
}

// --- 간단 테스트 (런타임에서 콘솔 확인) ---
try {
    (function test_computeNextId() {
        const L = [{ id: "a" }, { id: "b" }, { id: "c" }];
        console.assert(computeNextId(L, "a", { repeatOne: true, autoNext: true }) === "a", "repeatOne 우선 실패");
        console.assert(computeNextId(L, "a", { repeatOne: false, autoNext: true }) === "b", "다음 이동 실패");
        console.assert(computeNextId(L, "c", { repeatOne: false, autoNext: true }) === null, "마지막 정지 실패");
        console.assert(computeNextId(L, "x", { repeatOne: false, autoNext: true }) === "a", "미매치 시 첫 항목 실패");
        console.assert(computeNextId(L, "b", { repeatOne: false, autoNext: false }) === null, "autoNext=false 실패");
    })();
} catch {}

const TABS = [
    { key: "video", label: "영상" },
    { key: "youtube", label: "유튜브" },
];

const ytThumb = (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

function guessThumbFromUrl(url) {
    try {
        const u = new URL(url);
        const file = u.pathname.split("/").pop();
        const base = file.replace(/\.[^.]+$/, "");
        return `${u.origin}/thumbs/${base}.jpg`;
    } catch {
        return undefined;
    }
}

function Badge({ children }) {
    return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 border">{children}</span>;
}

// 재생중 표시 아이콘 (깜빡이는 그린 도트)
function NowPlayingIcon() {
    return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600">
      <span className="relative inline-flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
      </span>
      재생중
    </span>
    );
}

function SearchBox({ value, onChange }) {
    return (
        <div className="flex items-center gap-2 p-2 border rounded-xl bg-white shadow-sm">
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="영상 검색 (제목/태그)"
                className="w-full outline-none text-sm"
            />
        </div>
    );
}

function LoginGate({ onPass }) {
    const [id, setId] = useState("");
    const [pw, setPw] = useState("");
    const [err, setErr] = useState("");

    useEffect(() => {
        const ok = sessionStorage.getItem("vp-login-ok");
        if (ok === "1") onPass();
    }, [onPass]);

    function submit(e) {
        e.preventDefault();
        if (id === "asd" && pw === "asd") {
            sessionStorage.setItem("vp-login-ok", "1");
            onPass();
        } else setErr("아이디 또는 비밀번호가 올바르지 않습니다.");
    }

    return (
        <div className="min-h-[100dvh] w-screen flex items-center justify-center bg-gray-50 p-4">
            <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl border shadow p-6 space-y-4">
                <h1 className="text-xl font-bold">영상 재생 앱 로그인</h1>
                <div className="space-y-2">
                    <input value={id} onChange={(e) => setId(e.target.value)} placeholder="아이디(asd)" className="w-full border rounded-lg px-3 py-2" />
                    <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호(asd)" type="password" className="w-full border rounded-lg px-3 py-2" />
                    {err && <div className="text-sm text-red-600">{err}</div>}
                </div>
                <button type="submit" className="w-full py-2 rounded-lg bg-black text-white">로그인</button>
            </form>
        </div>
    );
}

export default function App() {
    const [authed, setAuthed] = useState(false);
    const [tab, setTab] = useState("video");
    const [query, setQuery] = useState("");
    const [currentId, setCurrentId] = useState(null);
    const [repeatOne, setRepeatOne] = useState(() => localStorage.getItem("vp-repeatOne") === "1");
    const [autoNext, setAutoNext] = useState(() => localStorage.getItem("vp-autoNext") !== "0");
    const [playlist, setPlaylist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const ytPlayerRef = useRef(null);
    const videoRef = useRef(null);

    useEffect(() => localStorage.setItem("vp-repeatOne", repeatOne ? "1" : "0"), [repeatOne]);
    useEffect(() => localStorage.setItem("vp-autoNext", autoNext ? "1" : "0"), [autoNext]);

    useEffect(() => {
        fetch(PLAYLIST_URL)
            .then((res) => res.json())
            .then((data) => setPlaylist(Array.isArray(data) ? data : []))
            .catch((err) => setError(`플레이리스트 로드 실패: ${err.message}`))
            .finally(() => setLoading(false));
    }, []);

    const items = useMemo(() => {
        const q = query.trim().toLowerCase();
        return playlist
            .filter((v) => (tab === "youtube" ? v.type === "youtube" : v.type === "file" || v.type === "hls"))
            .filter((v) => {
                if (!q) return true;
                return (v.title || "").toLowerCase().includes(q) || (v.tags || []).some((t) => (t || "").toLowerCase().includes(q));
            });
    }, [tab, query, playlist]);

    const current = useMemo(() => items.find((v) => v.id === currentId) || items[0], [items, currentId]);

    function handleEnded() {
        if (repeatOne && videoRef.current) {
            try { videoRef.current.currentTime = 0; videoRef.current.play(); } catch {}
            return;
        }
        const nid = computeNextId(items, current ? current.id : null, { repeatOne, autoNext });
        if (nid && (!current || nid !== current.id)) setCurrentId(nid);
    }

    // --- YouTube IFrame API 초기화/생명주기 ---
    // (1) 유튜브 탭에 들어올 때 1회 생성, 탭을 벗어날 때만 destroy
    const ytReadyRef = useRef(false);
    useEffect(() => {
        if (!(current && current.type === "youtube")) {
            // 유튜브 탭이 아니면 플레이어 정리 후 종료
            if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
                try { ytPlayerRef.current.destroy(); } catch {}
                ytPlayerRef.current = null;
                ytReadyRef.current = false;
            }
            return;
        }

        function bindEnded(player) {
            try {
                player.addEventListener("onStateChange", (e) => {
                    // 0: ENDED, 1: PLAYING, 2: PAUSED, 3: BUFFERING, 5: CUED
                    if (e.data === window.YT.PlayerState.ENDED) {
                        // 다음 트랙으로
                        setTimeout(() => handleEnded(), 0);
                    }
                });
            } catch {}
        }

        function createPlayer() {
            ytPlayerRef.current = new window.YT.Player("yt-player", {
                videoId: current.youtubeId,
                playerVars: {
                    autoplay: 1,
                    controls: 1,
                    rel: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    origin: window.location.origin,
                },
                events: {
                    onReady: (e) => {
                        ytReadyRef.current = true;
                        try { e.target.playVideo(); } catch {}
                    },
                    onError: () => {
                        // 에러 시에도 다음으로 진행
                        handleEnded();
                    },
                },
            });
            bindEnded(ytPlayerRef.current);
        }

        // IFrame API 준비
        if (window.YT && window.YT.Player) {
            if (!ytPlayerRef.current) createPlayer();
        } else {
            if (!document.getElementById("yt-iframe-api")) {
                const tag = document.createElement("script");
                tag.id = "yt-iframe-api";
                tag.src = "https://www.youtube.com/iframe_api";
                document.body.appendChild(tag);
            }
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = function () {
                if (typeof prev === "function") try { prev(); } catch {}
                if (!ytPlayerRef.current) createPlayer();
            };
        }

        return () => {
            // 유튜브 탭을 벗어나는 경우에만 실제 destroy (current 변경에는 destroy 금지)
            const stillYoutube = current && current.type === "youtube";
            if (!stillYoutube && ytPlayerRef.current && ytPlayerRef.current.destroy) {
                try { ytPlayerRef.current.destroy(); } catch {}
                ytPlayerRef.current = null;
                ytReadyRef.current = false;
            }
        };
    }, [tab]);

    // (2) 같은 탭 내에서 영상만 바뀌는 경우엔 loadVideoById로 교체
    useEffect(() => {
        if (!(current && current.type === "youtube")) return;
        const p = ytPlayerRef.current;
        if (p && typeof p.loadVideoById === "function") {
            try { p.loadVideoById(current.youtubeId); } catch {}
            try { p.playVideo && p.playVideo(); } catch {}
        }
    }, [current && current.type === "youtube" ? current.youtubeId : null]);

    useEffect(() => {
        if (!current && items.length) setCurrentId(items[0].id);
    }, [current, items]);

    if (!authed) return <LoginGate onPass={() => setAuthed(true)} />;

    return (
        <div className="min-h-[100dvh] w-screen bg-gray-50 p-3 sm:p-4 lg:p-6">
            <div className="w-full space-y-4">
                <header className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">내 영상 플레이어</h1>
                    <div className="flex items-center gap-4 text-sm">
                        <label className="flex items-center gap-1">
                            <input type="checkbox" checked={repeatOne} onChange={(e) => setRepeatOne(e.target.checked)} /> 반복
                        </label>
                        <label className="flex items-center gap-1">
                            <input type="checkbox" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} /> 자동다음
                        </label>
                    </div>
                </header>

                <nav className="flex gap-2">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`px-3 py-2 rounded-xl border text-sm ${tab === t.key ? "bg-black text-white" : "bg-white"}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
                    <section className="space-y-3">
                        <div className="text-base sm:text-lg font-semibold">{current ? current.title : "선택 없음"}</div>
                        {current && (
                            current.type === "youtube" ? (
                                <div id="yt-player" className="w-full aspect-video rounded-xl border" />
                            ) : (
                                <video
                                    ref={videoRef}
                                    key={current.url}
                                    src={current.url}
                                    controls
                                    autoPlay
                                    onEnded={handleEnded}
                                    className="w-full aspect-video rounded-xl border"
                                />
                            )
                        )}
                    </section>

                    <aside className="space-y-3">
                        <SearchBox value={query} onChange={setQuery} />
                        <div className="overflow-auto rounded-2xl border bg-white divide-y h-[calc(100dvh-260px)] sm:h-[calc(100dvh-250px)] lg:h-[calc(100dvh-240px)]">
                            {loading && <div className="p-6 text-sm">불러오는 중…</div>}
                            {!loading && error && <div className="p-6 text-sm text-red-600">{error}</div>}
                            {!loading && !error && items.map((item) => {
                                const active = current ? item.id === current.id : false;
                                const thumb = item.thumb || (item.type === "youtube" ? ytThumb(item.youtubeId) : guessThumbFromUrl(item.url));
                                return (
                                    <button
                                        key={item.id}
                                        aria-current={active ? "true" : "false"}
                                        title={active ? "현재 재생중" : "재생"}
                                        onClick={() => setCurrentId(item.id)}
                                        className={`w-full flex gap-3 items-center p-3 pl-2 transition ${
                                            active
                                                ? "bg-green-50 border-l-4 border-green-500"
                                                : "hover:bg-gray-50 border-l-4 border-transparent"
                                        }`}
                                    >
                                        <div className="w-20 h-14 sm:w-24 sm:h-16 md:w-28 md:h-20 rounded bg-gray-100 overflow-hidden">
                                            {thumb ? (
                                                <img src={thumb} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full grid place-items-center text-xs text-gray-400">NO THUMB</div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <div className="font-medium truncate">{item.title}</div>
                                                {active && <NowPlayingIcon />}
                                            </div>
                                            <div className="text-xs text-gray-500 flex gap-2 mt-0.5">
                                                <span>{(item.type || "").toUpperCase()}</span>
                                                {(item.tags || []).slice(0, 3).map((t) => <Badge key={t}>#{t}</Badge>)}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>
                </div>

                <footer className="mt-2 text-xs text-gray-500">© 2025 Video Player • React + Tailwind</footer>
            </div>
        </div>
    );
}
