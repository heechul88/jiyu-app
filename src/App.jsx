import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { computeNextId } from "./utils/playlistUtils.js";
import { formatFileSize } from "./utils/fileUtils.js";
import { pwaManager } from "./utils/pwaManager.js";

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

// File upload UI/handlers were removed per request.

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
    
    // Refs
    const ytPlayerRef = useRef(null);
    const videoRef = useRef(null);
    const ytReadyRef = useRef(false);
    const ytPlayerContainerRef = useRef(null);
    const cleanupTimeoutRef = useRef(null);
    const playerCreationTimeoutRef = useRef(null);
    const isComponentMountedRef = useRef(true);
    const tabSwitchCountRef = useRef(0);

    // File upload functionality removed.

    // YouTube 플레이어 정리를 위한 개선된 함수
    const cleanupYouTubePlayer = useCallback(() => {
        console.log("YouTube 플레이어 정리 시작");
        
        // 1. 플레이어 인스턴스 정리
        if (ytPlayerRef.current) {
            try {
                if (typeof ytPlayerRef.current.destroy === 'function') {
                    ytPlayerRef.current.destroy();
                }
            } catch (e) {
                console.warn("플레이어 destroy 중 무시되는 오류:", e.message);
            }
            ytPlayerRef.current = null;
        }
        
        // 2. 컨테이너 정리 - ref를 통해 안전하게 접근
        if (ytPlayerContainerRef.current) {
            try {
                // innerHTML을 사용하여 안전하게 정리
                ytPlayerContainerRef.current.innerHTML = '';
                console.log("YouTube 컨테이너 정리 완료");
            } catch (e) {
                console.warn("컨테이너 정리 중 무시되는 오류:", e.message);
            }
        }
        
        console.log("YouTube 플레이어 정리 완료");
    }, []);

    // 컴포넌트 언마운트 시 flag 설정
    useEffect(() => {
        isComponentMountedRef.current = true;
        return () => {
            isComponentMountedRef.current = false;
            // 모든 타이머 정리
            if (cleanupTimeoutRef.current) {
                clearTimeout(cleanupTimeoutRef.current);
            }
            if (playerCreationTimeoutRef.current) {
                clearTimeout(playerCreationTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => localStorage.setItem("vp-repeatOne", repeatOne ? "1" : "0"), [repeatOne]);
    useEffect(() => localStorage.setItem("vp-autoNext", autoNext ? "1" : "0"), [autoNext]);

    // 탭 변경 시마다 플레이리스트 새로 로드
    useEffect(() => {
        console.log(`탭 ${tab}으로 변경 - 플레이리스트 새로 로드 시작`);
        setLoading(true);
        setError("");
        
        fetch(PLAYLIST_URL + `?t=${Date.now()}`) // 캐시 방지
            .then((res) => res.json())
            .then((data) => {
                console.log(`플레이리스트 로드 완료 (탭: ${tab}):`, data?.length || 0, "개 항목");
                setPlaylist(Array.isArray(data) ? data : []);
            })
            .catch((err) => {
                console.error(`플레이리스트 로드 실패 (탭: ${tab}):`, err);
                setError(`플레이리스트 로드 실패: ${err.message}`);
            })
            .finally(() => setLoading(false));
    }, [tab]);

    const items = useMemo(() => {
        try {
            const allItems = [...(Array.isArray(playlist) ? playlist : [])];
            
            const q = query.trim().toLowerCase();
            const filteredItems = allItems
                .filter((v) => v && typeof v === 'object' && v.id) // 유효한 객체만 필터링 (id 필수)
                .filter((v) => {
                    if (tab === "youtube") {
                        return v.type === "youtube";
                    } else {
                        return v.type === "file" || v.type === "hls" || v.type === "image" || v.uploadedFile;
                    }
                })
                .filter((v) => {
                    if (!q) return true;
                    const title = (v.title || "").toLowerCase();
                    const tags = (v.tags || []).join(" ").toLowerCase();
                    return title.includes(q) || tags.includes(q);
                });
            
            console.log(`탭 ${tab}의 필터된 아이템 수:`, filteredItems.length);
            return filteredItems;
        } catch (error) {
            console.error("items 필터링 중 오류:", error);
            return [];
        }
    }, [tab, query, playlist]);

    const current = useMemo(() => {
        try {
            if (!items || items.length === 0) {
                console.log("현재 탭에 표시할 아이템이 없음");
                return null;
            }
            
            if (!currentId) {
                console.log("currentId가 없어서 첫 번째 아이템 반환:", items[0]?.id);
                return items[0];
            }
            
            const found = items.find((v) => v && v.id === currentId);
            if (!found) {
                console.log(`currentId ${currentId}에 해당하는 아이템이 없어서 첫 번째 아이템 반환:`, items[0]?.id);
                return items[0];
            }
            
            console.log("현재 선택된 아이템:", found.id);
            return found;
        } catch (error) {
            console.error("current 아이템 선택 중 오류:", error);
            return items && items.length > 0 ? items[0] : null;
        }
    }, [items, currentId]);

    function handleEnded() {
        console.log("handleEnded 호출됨");
        console.log("현재 상태 - repeatOne:", repeatOne, "autoNext:", autoNext);
        console.log("현재 영상 타입:", current?.type);
        
        try {
            // 1. 반복 재생이 체크된 경우 - 현재 영상을 반복
            if (repeatOne) {
                console.log("🔄 반복 재생 모드 - 현재 영상 반복");
                
                // 일반 비디오 반복 재생
                if (videoRef.current && current?.type !== "youtube") {
                    console.log("일반 비디오 반복 재생 실행");
                    try { 
                        videoRef.current.currentTime = 0; 
                        videoRef.current.play(); 
                        console.log("✅ 일반 비디오 반복 재생 성공");
                    } catch (error) {
                        console.error("❌ 일반 비디오 반복 재생 중 오류:", error);
                    }
                    return;
                }
                
                // YouTube 반복 재생
                if (ytPlayerRef.current && current && current.type === "youtube") {
                    console.log("YouTube 반복 재생 실행");
                    try {
                        ytPlayerRef.current.seekTo(0);
                        ytPlayerRef.current.playVideo();
                        console.log("✅ YouTube 반복 재생 성공");
                    } catch (error) {
                        console.error("❌ YouTube 반복 재생 중 오류:", error);
                    }
                    return;
                }
            }
            
            // 2. 자동 다음이 체크된 경우 - 다음 영상으로 이동
            if (autoNext) {
                console.log("➡️ 자동 다음 모드 - 다음 영상으로 이동");
                
                if (!current) {
                    console.log("current가 없어서 다음 재생 건너뜀");
                    return;
                }
                
                const nid = computeNextId(items, current.id, { repeatOne: false, autoNext: true });
                console.log("다음 재생 ID:", nid);
                
                if (nid && nid !== current.id) {
                    console.log(`✅ 다음 영상으로 변경: ${current.id} -> ${nid}`);
                    setCurrentId(nid);
                } else {
                    console.log("⏹️ 다음 재생할 영상이 없음 - 재생 중지");
                }
                return;
            }
            
            // 3. 둘 다 체크되지 않은 경우 - 재생 중지
            console.log("⏹️ 자동 기능 미설정 - 재생 중지");
            
        } catch (error) {
            console.error("❌ handleEnded 실행 중 오류:", error);
        }
    }

    // --- YouTube IFrame API 초기화/생명주기 (개선) ---
    useEffect(() => {
        console.log(`YouTube API 초기화 useEffect 실행: tab=${tab}`);
        
        // 이전 정리 작업 취소
        if (cleanupTimeoutRef.current) {
            clearTimeout(cleanupTimeoutRef.current);
            cleanupTimeoutRef.current = null;
        }

        // YouTube 탭이 아닐 때 정리
        if (tab !== "youtube") {
            console.log("YouTube 탭이 아니므로 플레이어 정리");
            cleanupYouTubePlayer();
            return;
        }

        // YouTube 탭일 때 API 초기화
        console.log("YouTube 탭이므로 API 초기화");
        
        if (!window.YT && !document.getElementById("yt-iframe-api")) {
            console.log("YouTube API 스크립트 로드 시작");
            const tag = document.createElement("script");
            tag.id = "yt-iframe-api";
            tag.src = "https://www.youtube.com/iframe_api";
            document.head.appendChild(tag);
            
            window.onYouTubeIframeAPIReady = function () {
                console.log("YouTube API 초기화 완료");
                ytReadyRef.current = true;
            };
        } else if (window.YT && window.YT.Player) {
            console.log("YouTube API 이미 로드됨");
            ytReadyRef.current = true;
        }

        return () => {
            console.log("YouTube API useEffect 정리 함수 실행");
            if (cleanupTimeoutRef.current) {
                clearTimeout(cleanupTimeoutRef.current);
                cleanupTimeoutRef.current = null;
            }
        };
    }, [tab, cleanupYouTubePlayer]);

    // YouTube 플레이어 생성 (개선)
    useEffect(() => {
        if (playerCreationTimeoutRef.current) {
            clearTimeout(playerCreationTimeoutRef.current);
            playerCreationTimeoutRef.current = null;
        }

        // 필수 조건 체크
        if (!(current && current.type === "youtube" && current.youtubeId)) {
            console.log("YouTube 플레이어 생성 조건 미충족 - current:", current?.type, current?.youtubeId);
            return;
        }
        
        if (tab !== "youtube") {
            console.log("YouTube 탭이 아니므로 플레이어 생성 중단");
            return;
        }

        console.log("YouTube 플레이어 생성 조건 확인 중...");
        console.log("- window.YT:", !!window.YT);
        console.log("- window.YT.Player:", !!(window.YT && window.YT.Player));
        console.log("- ytReadyRef.current:", ytReadyRef.current);

        const createPlayer = () => {
            try {
                if (!isComponentMountedRef.current || tab !== "youtube") {
                    console.log("컴포넌트 언마운트되었거나 탭이 변경되어 플레이어 생성 중단");
                    return;
                }

                // 기존 플레이어 정리
                cleanupYouTubePlayer();
                
                // 다시 한번 상태 확인
                if (!isComponentMountedRef.current || tab !== "youtube") {
                    return;
                }

                // ref를 통해 컨테이너에 접근
                if (!ytPlayerContainerRef.current) {
                    console.warn("YouTube 플레이어 컨테이너 ref를 찾을 수 없습니다");
                    return;
                }
                
                console.log("YouTube 플레이어 생성 시작:", current.youtubeId);
                
                // 고유한 div 생성
                const playerDiv = document.createElement('div');
                playerDiv.id = `yt-player-${Date.now()}`;
                playerDiv.style.width = '100%';
                playerDiv.style.height = '100%';
                ytPlayerContainerRef.current.appendChild(playerDiv);
                
                ytPlayerRef.current = new window.YT.Player(playerDiv.id, {
                    height: '100%',
                    width: '100%',
                    videoId: current.youtubeId,
                    playerVars: {
                        autoplay: 1, // 자동재생 활성화
                        controls: 1,
                        rel: 0,
                        modestbranding: 1,
                        playsinline: 1,
                        origin: window.location.origin,
                        mute: 0, // 음소거 해제
                        enablejsapi: 1
                    },
                    events: {
                        onReady: (e) => {
                            console.log("YouTube 플레이어 준비 완료:", current.youtubeId);
                            console.log("플레이어 상태:", e.target.getPlayerState());
                            
                            if (tab === "youtube" && isComponentMountedRef.current) {
                                // 약간의 지연 후 재생 시도 (DOM 안정화)
                                setTimeout(() => {
                                    try {
                                        console.log("자동 재생 시도 중...");
                                        
                                        // 음소거 해제
                                        if (e.target.isMuted()) {
                                            e.target.unMute();
                                            console.log("YouTube 플레이어 음소거 해제");
                                        }
                                        
                                        e.target.playVideo();
                                        console.log("YouTube 자동 재생 명령 실행 완료");
                                        
                                        // 재생 상태 확인
                                        setTimeout(() => {
                                            const state = e.target.getPlayerState();
                                            console.log("재생 후 플레이어 상태:", state);
                                            if (state === window.YT.PlayerState.PLAYING) {
                                                console.log("✅ YouTube 자동 재생 성공!");
                                            } else if (state === window.YT.PlayerState.PAUSED) {
                                                console.log("⚠️ YouTube 재생이 일시정지됨 - 재시도");
                                                e.target.playVideo();
                                            }
                                        }, 500);
                                        
                                    } catch (error) {
                                        console.error("YouTube 자동 재생 실패:", error);
                                    }
                                }, 300);
                            }
                        },
                        onStateChange: (e) => {
                            console.log("YouTube 플레이어 상태 변경:", e.data);
                            if (e.data === window.YT.PlayerState.ENDED && tab === "youtube" && isComponentMountedRef.current) {
                                console.log("YouTube 영상 종료, 다음 영상 재생");
                                setTimeout(() => handleEnded(), 100);
                            }
                        },
                        onError: (e) => {
                            console.error("YouTube 플레이어 오류:", e);
                            if (tab === "youtube" && isComponentMountedRef.current) {
                                setTimeout(() => handleEnded(), 100);
                            }
                        },
                    },
                });
            } catch (error) {
                console.error("YouTube 플레이어 생성 중 오류:", error);
            }
        };

        // YouTube API 상태 확인 및 플레이어 생성
        const attemptPlayerCreation = () => {
            if (!window.YT || !window.YT.Player) {
                console.log("YouTube API 아직 로드되지 않음");
                return false;
            }
            
            console.log("YouTube API 준비 완료 - 플레이어 생성 진행");
            playerCreationTimeoutRef.current = setTimeout(() => createPlayer(), 200);
            return true;
        };

        if (!attemptPlayerCreation()) {
            console.log("YouTube API 대기 중...");
            let checkCount = 0;
            const checkAPI = setInterval(() => {
                checkCount++;
                console.log(`YouTube API 로드 체크 ${checkCount}/50`);
                
                if (window.YT && window.YT.Player) {
                    console.log("YouTube API 로드 완료!");
                    ytReadyRef.current = true;
                    clearInterval(checkAPI);
                    attemptPlayerCreation();
                } else if (checkCount > 50) {
                    clearInterval(checkAPI);
                    console.error("YouTube API 로드 타임아웃 - 5초 초과");
                }
            }, 100);
            
            return () => {
                clearInterval(checkAPI);
                if (playerCreationTimeoutRef.current) {
                    clearTimeout(playerCreationTimeoutRef.current);
                    playerCreationTimeoutRef.current = null;
                }
            };
        }
        
        return () => {
            if (playerCreationTimeoutRef.current) {
                clearTimeout(playerCreationTimeoutRef.current);
                playerCreationTimeoutRef.current = null;
            }
        };
    }, [current && current.type === "youtube" ? current.youtubeId : null, tab, cleanupYouTubePlayer]);

    // 탭 변경 시 영상 정지 및 상태 초기화
    useEffect(() => {
        tabSwitchCountRef.current += 1;
        console.log(`탭 변경됨: ${tab} (${tabSwitchCountRef.current}번째 전환)`);
        
        if (!isComponentMountedRef.current) {
            console.log("컴포넌트가 언마운트되어 탭 변경 처리 중단");
            return;
        }
        
        // 이전 탭의 영상 정지 및 정리
        console.log("이전 탭의 영상 정지 시작");
        
        // 1. 일반 비디오 정지
        if (videoRef.current) {
            try {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
                console.log("일반 비디오 정지 완료");
            } catch (e) {
                console.warn("비디오 정지 중 오류:", e);
            }
        }
        
        // 2. YouTube 플레이어 정지 및 정리
        if (ytPlayerRef.current) {
            try {
                if (typeof ytPlayerRef.current.pauseVideo === 'function') {
                    ytPlayerRef.current.pauseVideo();
                }
                console.log("YouTube 플레이어 정지 완료");
            } catch (e) {
                console.warn("YouTube 플레이어 정지 중 오류:", e);
            }
        }
        
        // 3. 플레이어 완전 정리 (탭이 변경되었을 때만)
        if (tabSwitchCountRef.current > 1) {
            cleanupYouTubePlayer();
        }
        
        // React의 배치 업데이트를 활용하여 한 번에 상태 변경
        React.startTransition(() => {
            setQuery("");
            setCurrentId(null);
        });
    }, [tab, cleanupYouTubePlayer]);

    // items 변경 시 currentId 유효성 검사 및 첫 번째 영상 자동 선택
    useEffect(() => {
        try {
            if (!isComponentMountedRef.current) return;
            
            if (items.length === 0) {
                console.log("아이템이 없어서 currentId를 null로 설정");
                setCurrentId(prevId => isComponentMountedRef.current ? null : prevId);
                return;
            }

            // currentId가 없거나 items에 해당 ID가 없으면 첫 번째 아이템으로 설정
            const currentExists = currentId && items.some(item => item && item.id === currentId);
            
            if (!currentExists) {
                const firstItem = items[0];
                if (firstItem && firstItem.id) {
                    console.log(`탭 ${tab}의 첫 번째 아이템으로 자동 선택:`, firstItem.title);
                    setCurrentId(prevId => isComponentMountedRef.current ? firstItem.id : prevId);
                }
            } else {
                console.log(`탭 ${tab}에서 기존 currentId 유지:`, currentId);
            }
        } catch (error) {
            console.error("items 변경 시 currentId 설정 중 오류:", error);
        }
    }, [items, tab]); // currentId 의존성 제거로 무한 루프 방지

    if (!authed) return <LoginGate onPass={() => setAuthed(true)} />;

    return (
        <div className="min-h-[100dvh] w-screen bg-gray-50 p-3 sm:p-4 lg:p-6">
            <div className="w-full space-y-4">
                <header className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">내 영상 플레이어</h1>
                    <div className="flex items-center gap-4 text-sm">
                        <label className={`flex items-center gap-2 px-3 py-1 rounded-lg border cursor-pointer transition-colors ${
                            repeatOne ? 'bg-orange-100 border-orange-300 text-orange-800' : 'bg-white border-gray-300 hover:bg-gray-50'
                        }`}>
                            <input 
                                type="checkbox" 
                                checked={repeatOne} 
                                onChange={(e) => {
                                    console.log("반복 체크박스 변경:", e.target.checked);
                                    setRepeatOne(e.target.checked);
                                    if (e.target.checked) {
                                        console.log("🔄 반복 재생 모드 활성화 - 자동 다음 비활성화");
                                        setAutoNext(false); // 반복이 활성화되면 자동다음 비활성화
                                    }
                                }} 
                                className="rounded"
                            /> 
                            <span>🔄 반복 재생</span>
                        </label>
                        <label className={`flex items-center gap-2 px-3 py-1 rounded-lg border cursor-pointer transition-colors ${
                            autoNext ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-gray-300 hover:bg-gray-50'
                        }`}>
                            <input 
                                type="checkbox" 
                                checked={autoNext} 
                                onChange={(e) => {
                                    console.log("자동 다음 체크박스 변경:", e.target.checked);
                                    setAutoNext(e.target.checked);
                                    if (e.target.checked) {
                                        console.log("➡️ 자동 다음 모드 활성화 - 반복 재생 비활성화");
                                        setRepeatOne(false); // 자동다음이 활성화되면 반복 비활성화
                                    }
                                }} 
                                className="rounded"
                            /> 
                            <span>➡️ 자동 다음</span>
                        </label>
                    </div>
                </header>

                <nav className="flex gap-2">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => {
                                console.log(`탭 클릭: ${t.key} (현재 탭: ${tab})`);
                                try {
                                    if (!isComponentMountedRef.current) {
                                        console.log("컴포넌트가 언마운트되어 탭 클릭 무시");
                                        return;
                                    }
                                    if (t.key !== tab) {
                                        console.log(`탭 변경 시도: ${tab} -> ${t.key}`);
                                        setTab(t.key);
                                    } else {
                                        console.log("같은 탭 클릭으로 변경 없음");
                                    }
                                } catch (error) {
                                    console.error("탭 변경 중 오류:", error);
                                }
                            }}
                            className={`px-3 py-2 rounded-xl border text-sm ${tab === t.key ? "bg-black text-white" : "bg-white"}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
                    <section className="space-y-3">
                        <div className="text-base sm:text-lg font-semibold">{current ? current.title : "선택 없음"}</div>
                        {current ? (
                            current.type === "youtube" ? (
                                <div 
                                    ref={ytPlayerContainerRef}
                                    className="w-full aspect-video rounded-xl border bg-black relative cursor-pointer"
                                    style={{ minHeight: '200px' }}
                                    key={`youtube-player-${current.youtubeId}`}
                                    onClick={() => {
                                        // YouTube 플레이어가 음소거 상태면 해제
                                        if (ytPlayerRef.current && typeof ytPlayerRef.current.isMuted === 'function') {
                                            try {
                                                if (ytPlayerRef.current.isMuted()) {
                                                    ytPlayerRef.current.unMute();
                                                    console.log("YouTube 플레이어 음소거 해제");
                                                }
                                            } catch (e) {
                                                console.warn("음소거 해제 중 오류:", e);
                                            }
                                        }
                                    }}
                                />
                            ) : current.url ? (
                                <video
                                    ref={videoRef}
                                    key={`${current.id}-${current.url}`}
                                    src={current.url}
                                    controls
                                    autoPlay
                                    muted={false}
                                    playsInline
                                    onLoadedData={() => {
                                        // 비디오 로드 완료 시 자동 재생 시도
                                        if (videoRef.current) {
                                            console.log("비디오 로드 완료, 자동 재생 시도:", current.title);
                                            videoRef.current.play().catch(error => {
                                                console.log("자동 재생 실패:", error);
                                                // 음소거 상태로 재생 시도
                                                videoRef.current.muted = true;
                                                videoRef.current.play().catch(e => {
                                                    console.log("음소거 재생도 실패:", e);
                                                });
                                            });
                                        }
                                    }}
                                    onCanPlay={() => {
                                        // 재생 가능한 상태가 되면 자동 재생
                                        if (videoRef.current && videoRef.current.paused) {
                                            console.log("재생 가능 상태, 자동 재생 시도");
                                            videoRef.current.play().catch(error => {
                                                console.log("canPlay 자동 재생 실패:", error);
                                            });
                                        }
                                    }}
                                    onEnded={handleEnded}
                                    className="w-full aspect-video rounded-xl border bg-black"
                                    onError={(e) => {
                                        console.error("비디오 로딩 오류:", e);
                                        // 비디오 로딩 실패 시 다음 아이템으로 자동 이동
                                        if (items && items.length > 1) {
                                            const currentIndex = items.findIndex(item => item && item.id === current.id);
                                            if (currentIndex >= 0) {
                                                const nextIndex = (currentIndex + 1) % items.length;
                                                const nextItem = items[nextIndex];
                                                if (nextItem && nextItem.id) {
                                                    setCurrentId(nextItem.id);
                                                }
                                            }
                                        }
                                    }}
                                />
                            ) : null
                        ) : (
                            <div className="w-full aspect-video rounded-xl border bg-gray-100 flex items-center justify-center">
                                <div className="text-gray-500 text-center">
                                    <div className="text-lg mb-2">📺</div>
                                    <div className="text-sm">
                                        {loading ? "로딩 중..." : 
                                         error ? "오류가 발생했습니다" : 
                                         "재생할 영상을 선택하세요"}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    <aside className="space-y-3">
                        <SearchBox value={query} onChange={setQuery} />
                        {/* File upload section removed */}
                        <div className="overflow-auto rounded-2xl border bg-white divide-y h-[calc(100dvh-400px)] sm:h-[calc(100dvh-390px)] lg:h-[calc(100dvh-380px)]">
                            {loading && <div className="p-6 text-sm">불러오는 중…</div>}
                            {!loading && error && <div className="p-6 text-sm text-red-600">{error}</div>}
                            {!loading && !error && items.length === 0 && (
                                <div className="p-6 text-sm text-gray-500 text-center">
                                    {query ? `"${query}" 검색 결과가 없습니다.` : "표시할 영상이 없습니다."}
                                </div>
                            )}
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
