import Vault3D from './Vault3D.jsx';
import MarketStats from './MarketStats.jsx';

// Loaded lazily (own chunk) after first paint: the 3D vault and the stat tiles
// sit below the search box, so they must not compete with it for the main thread.
export default function Overview({ featured, onPick, onOpen }) {
  return (
    <>
      <Vault3D items={featured?.featured} onSelect={onOpen} />
      <MarketStats stats={featured?.stats} onPick={onPick} />
    </>
  );
}
