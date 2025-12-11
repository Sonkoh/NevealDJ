import Deck from "./Deck";
import Mixer from "./Mixer";

function Decks() {
    return (
        <main className="flex-row">
            <Deck id={1} />
            <Mixer />
            <Deck id={2} />
        </main>
    );
}

export default Decks;
