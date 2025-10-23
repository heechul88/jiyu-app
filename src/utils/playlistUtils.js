/**
 * 다음 재생 아이디 계산 (옵셔널 체이닝/널 병합 미사용 버전)
 */
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

// 간단 테스트 (런타임에서 콘솔 확인)
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