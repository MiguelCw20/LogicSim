export function createWire(fromId, toId, inputIndex) {
    return {
        id: crypto.randomUUID(),
        fromId,
        toId,
        inputIndex
    };
}
