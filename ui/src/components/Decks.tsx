import Deck from "./Deck";
import Mixer from "./Mixer";

function Decks() {
    return (
        <main className="grid grid-cols-[1fr_auto_1fr]">
            <Deck id={1} />
            <Mixer />
            <Deck id={2} />
        </main>
    );
}

export default Decks;
