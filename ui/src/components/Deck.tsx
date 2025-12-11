import { useState, useRef, MouseEvent } from "react";
import Icon from "./Icon";
import expandWindow from "../hooks/ExpandWindow";

type DeckProps = {
    id: string | number;
    disableExpand?: boolean;
};

function Deck({ id, disableExpand = false }: DeckProps) {
    const deckElement = useRef<HTMLElement>(null);
    const [deckData, setDeckData] = useState({});

    async () => {
        setDeckData(await (window as any).nevealdj.getDeck(id));
    };

    const handleExpand = (event: MouseEvent<HTMLButtonElement>) => {
        if (disableExpand) {
            return;
        }

        expandWindow(deckElement.current, id, {
            x: event.nativeEvent.screenX,
            y: event.nativeEvent.screenY,
        });
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
                    </div>
                </div>
            </main>
            <main className={(parseInt(id.toString())) % 2 == 1 ? 'flex-row-reverse' : 'flex-row'}>
                <div>
                    <button>plei</button>
                    <div className="grid grid-cols-1 grid-rows-1">
                        <div className="col-start-1 row-start-1 size-12 rounded-full border-4 border-gray-100 dark:border-gray-700">

                        </div>
                        <div className="col-start-1 row-start-1 size-12 rounded-full border-4 border-amber-500 mask-conic-from-75% mask-conic-to-75% dark:border-amber-400">

                        </div>
                    </div>
                </div>
            </main>
        </main>
    );
}

export default Deck;
