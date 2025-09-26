export const computeNextId = (list, currentId, opts) => {
    const {repeatOne, autoNext} = opts || {};
    if (!Array.isArray(list) || list.length === 0) return null;
    const idx = list.findIndex((v) => v && v.id === currentId);
    if (repeatOne) return currentId ?? list[0]?.id ?? null;
    if (!autoNext) return null;
    if (idx === -1) return list[0]?.id ?? null;
    if (idx < list.length - 1) return list[idx + 1]?.id ?? null;
    return null;
};