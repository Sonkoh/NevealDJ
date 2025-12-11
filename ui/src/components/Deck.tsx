import { useState, useRef, MouseEvent, useEffect } from "react";
import Icon from "./Icon";
import expandWindow from "../hooks/ExpandWindow";

type DeckProps = {
    id: string | number;
    disableExpand?: boolean;
};

type DeckState = {
    id: number;
    volume: number;
    isPlaying: boolean;
    loadedTrack?: string | null;
};

function Deck({ id, disableExpand = false }: DeckProps) {
    const deckElement = useRef<HTMLElement>(null);
    const [deckData, setDeckData] = useState<DeckState | null>(null);
    const deckId = id;

    const requestDeckState = async () => {
        try {
            const data = await (window as any).nevealdj?.getDeck?.(deckId);
            return data ?? null;
        } catch (error) {
            console.error("failed to retrieve deck info", error);
            return null;
        }
    };

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            const data = await requestDeckState();
            if (isMounted) {
                setDeckData(data);
            }
        };
        load();

        let unsubscribe: (() => void) | undefined;
        if ((window as any).nevealdj?.subscribeToEngineState) {
            unsubscribe = (window as any).nevealdj.subscribeToEngineState((state: any) => {
                const updated = state?.decks?.find?.((deck: DeckState) => deck.id === Number(deckId));
                if (updated) {
                    setDeckData(updated);
                }
            });
        }

        return () => {
            isMounted = false;
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [deckId]);

    const handleExpand = (event: MouseEvent<HTMLButtonElement>) => {
        if (disableExpand) {
            return;
        }

        expandWindow(deckElement.current, id, {
            x: event.nativeEvent.screenX,
            y: event.nativeEvent.screenY,
        });
    };

    const handlePlaybackToggle = async () => {
        try {
            const updated = await (window as any).nevealdj?.toggleDeckPlayback?.(deckId);
            if (updated) {
                setDeckData(updated);
            }
        } catch (error) {
            console.error("failed to toggle playback", error);
        }
    };

    return (
        <main className="w-full" ref={deckElement}>
            <main className="flex-row">
                <div className={`module-1 h-12 w-12 p-1 ${disableExpand ? '' : 'group'}`}>
                    <button
                        className={`flex flex-col items-center justify-center module-1 w-full h-full font-sans p-1 ${disableExpand ? 'border-2' : 'cursor-pointer'}`}
                        onClick={handleExpand}
                    >
                        <span className={`text-[8px] font-bold ${disableExpand ? '' : 'group-hover:hidden'}`}>
                            DECK
                        </span>
                        <div className={`text-[1.4em] leading-[.9] ${disableExpand ? '' : 'group-hover:hidden'}`}>
                            {id}
                        </div>
                        {!disableExpand && (
                            <Icon name="open_in_full" className="w-4 h-4 hidden group-hover:block" aria-hidden />
                        )}
                    </button>
                </div>
                <div className="module-1 w-full h-12 py-1 px-2 flex items-center justify-between gap-2">
                    <div>
                        <h1 className="font-600 text-[1em] me-0">
                            Nerver Back{" "}
                            <span className="text-[.9em] text-gray-400 font-normal">
                                - Ephesis<span className="text-gray-500">, Axiver</span>
                            </span>
                        </h1>
                        <p className="text-[.9em] font-boblackld text-orange-200">07:29 129<span className="text-[.8em]">BPM</span> Cm</p>
                        <p className="text-[.7em] text-gray-400 mt-1">
                            {deckData?.loadedTrack ? `Track: ${deckData.loadedTrack}` : "Track: --"}
                        </p>
                    </div>
                </div>
            </main>
            <main className={(parseInt(id.toString())) % 2 == 1 ? 'flex-row-reverse' : 'flex-row'}>
                <div className="module">
                    <button
                        className="px-4 py-2 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handlePlaybackToggle}
                    >
                        {deckData?.isPlaying ? "Pause" : "Play"}
                    </button>
                    <div className="grid grid-cols-1 grid-rows-1">
                        <div className="col-start-1 row-start-1 size-12 rounded-full border-4 border-gray-100 dark:border-gray-700">

                        </div>
                        <div className="col-start-1 row-start-1 size-12 rounded-full border-4 border-amber-500 mask-conic-from-75% mask-conic-to-75% dark:border-amber-400">

                        </div>
                    </div>
                </div>
                <div className="module w-full h-full">...</div>
            </main>
        </main>
    );
}

export default Deck;
