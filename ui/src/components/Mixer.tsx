import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import {
    FILE_SELECTED_EVENT,
    dispatchAppError,
    type FileSelectedDetail,
} from "../utils/appEvents";

type DeckState = {
    id: number;
    volume: number;
    isPlaying?: boolean;
    loadedTrack?: string | null;
};

type MixerFaderProps = {
    deck: DeckState;
    onVolumeChange: (deckId: number, volume: number) => void;
    onLoadTrack: (deckId: number) => void;
    canLoad: boolean;
    isLoadingTrack: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const sortDecks = (list?: DeckState[] | null) =>
    Array.isArray(list) ? [...list].sort((a, b) => a.id - b.id) : [];

function MixerFader({ deck, onVolumeChange, onLoadTrack, canLoad, isLoadingTrack }: MixerFaderProps) {
    const trackRef = useRef<HTMLDivElement | null>(null);

    const updateFromPointer = (clientY: number) => {
        const track = trackRef.current;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        const relativeY = clamp(clientY - rect.top, 0, rect.height);
        const percent = 1 - relativeY / rect.height;
        onVolumeChange(deck.id, clamp(percent, 0, 1));
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        updateFromPointer(event.clientY);

        const handleMove = (moveEvent: PointerEvent) => {
            moveEvent.preventDefault();
            updateFromPointer(moveEvent.clientY);
        };

        const handleUp = () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
    };

    const safeVolume = clamp(deck.volume ?? 0, 0, 1);
    const faderTop = `${(1 - safeVolume) * 100}%`;

    return (
        <div className="flex flex-col items-center px-2 py-2 w-20 min-h-0 select-none">
            <button
                type="button"
                className={`border-0 module py-1 w-full text-[.7em] font-bold rounded-xs text-gray-200 mb-2 ${
                    canLoad ? "cursor-pointer" : "cursor-not-allowed opacity-50 text-gray-500"
                }`}
                onClick={() => canLoad && onLoadTrack(deck.id)}
                disabled={!canLoad}
                aria-disabled={!canLoad}
            >
                {isLoadingTrack ? "LOADING..." : "LOAD"}
            </button>
            <span className="text-xs uppercase tracking-wide text-gray-300">Deck {deck.id}</span>
            <div
                ref={trackRef}
                className="relative flex-1 max-h-[50px] w-6 my-3 cursor-grab active:cursor-grabbing"
                onPointerDown={handlePointerDown}
            >
                <div className="absolute inset-x-1/2 -translate-x-1/2 h-full w-[2px] bg-gray-700" />
                <div className="absolute inset-0 flex flex-col items-center justify-between pointer-events-none">
                    {[...Array(3)].map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-[1px] w-6 bg-gray-500`}
                        />
                    ))}
                </div>
                <div
                    className="absolute left-1/2 w-6 h-2 bg-white rounded-xs shadow-lg -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
                    style={{ top: faderTop }}
                    aria-label={`${Math.round(safeVolume * 100)}%`}
                />
            </div>
        </div>
    );
}

function Mixer() {
    const [decks, setDecks] = useState<DeckState[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [visibleDeckCount, setVisibleDeckCount] = useState<number>(2);
    const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
    const [loadingDeckId, setLoadingDeckId] = useState<number | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadDecks = async () => {
            try {
                const response = await (window as any).nevealdj?.getDecks?.();
                if (isMounted) {
                    setDecks(sortDecks(response ?? []));
                }
            } catch (err) {
                console.error("Mixer: failed to load decks", err);
                if (isMounted) {
                    dispatchAppError("No se pudo cargar el mixer", "Mixer");
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadDecks();

        const loadConfig = async () => {
            const api = (window as any).nevealdj;
            if (!api?.getConfig) {
                return;
            }
            try {
                const config = await api.getConfig();
                if (!isMounted) {
                    return;
                }
                const requested = Number(config?.mixer?.visibleDeckCount);
                if (Number.isFinite(requested) && requested > 0) {
                    setVisibleDeckCount(Math.floor(requested));
                }
            } catch (err) {
                console.warn("Mixer: failed to load config", err);
            }
        };

        loadConfig();

        let unsubscribe: (() => void) | undefined;
        if ((window as any).nevealdj?.subscribeToEngineState) {
            unsubscribe = (window as any).nevealdj.subscribeToEngineState((state: any) => {
                if (!isMounted) {
                    return;
                }
                if (Array.isArray(state?.decks)) {
                    setDecks(sortDecks(state.decks));
                }
            });
        }

        const handleFileSelection = (event: Event) => {
            const detail = (event as CustomEvent<FileSelectedDetail>).detail;
            if (!isMounted) {
                return;
            }
            setSelectedFilePath(detail?.path ?? null);
        };

        if (typeof window !== "undefined") {
            window.addEventListener(FILE_SELECTED_EVENT, handleFileSelection as EventListener);
        }

        return () => {
            isMounted = false;
            if (unsubscribe) {
                unsubscribe();
            }
            if (typeof window !== "undefined") {
                window.removeEventListener(FILE_SELECTED_EVENT, handleFileSelection as EventListener);
            }
        };
    }, []);

    const handleVolumeChange = useCallback((deckId: number, volume: number) => {
        setDecks((prev) =>
            prev.map((deck) => (deck.id === deckId ? { ...deck, volume } : deck)),
        );

        const api = (window as any).nevealdj;
        if (!api?.setDeckVolume) {
            return;
        }

        api
            .setDeckVolume(deckId, volume)
            .catch((err: Error) => {
                console.error("Mixer: failed to set volume", err);
                dispatchAppError("No se pudo actualizar el volumen de ese deck", "Mixer");
            });
    }, []);

    const handleLoadTrack = useCallback(
        async (deckId: number) => {
            if (!selectedFilePath) {
                return;
            }
            const api = (window as any).nevealdj;
            if (!api?.loadDeck) {
                dispatchAppError("No se pudo acceder al cargador de decks", "Mixer");
                return;
            }
            setLoadingDeckId(deckId);
            try {
                await api.loadDeck(deckId, selectedFilePath);
            } catch (err) {
                console.error("Mixer: failed to load track", err);
                dispatchAppError("No se pudo cargar la canción seleccionada", "Mixer");
            } finally {
                setLoadingDeckId((current) => (current === deckId ? null : current));
            }
        },
        [selectedFilePath],
    );

    const decksToRender = decks.slice(0, visibleDeckCount);
    const hasDecks = decksToRender.length > 0;
    const hasSelectedTrack = Boolean(selectedFilePath);

    return (
        <div className="module-1 w-[320px] h-full flex flex-col">
            <div className="flex-1 overflow-x-auto">
                <div
                    className={`flex h-full px-3 py-4 ${
                        hasDecks ? "min-w-max" : "items-center justify-center"
                    }`}
                >
                    {isLoading ? (
                        <span className="text-sm text-gray-400">Cargando mixer...</span>
                    ) : hasDecks ? (
                        decksToRender.map((deck) => (
                            <MixerFader
                                key={deck.id}
                                deck={deck}
                                onVolumeChange={handleVolumeChange}
                                onLoadTrack={handleLoadTrack}
                                canLoad={hasSelectedTrack && loadingDeckId !== deck.id}
                                isLoadingTrack={loadingDeckId === deck.id}
                            />
                        ))
                    ) : (
                        <span className="text-sm text-gray-400">No hay decks disponibles.</span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Mixer;
