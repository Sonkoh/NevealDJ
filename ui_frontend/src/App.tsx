import { useState } from "react";

function App() {
  const [res, setRes] = useState("");

  const callPing = async () => {
    const response = await (window as any).nevealdj.ping();
    setRes(response);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>NevealDJ UI</h1>

      <button onClick={callPing}>Test ping()</button>

      <p>Respuesta: {res}</p>
    </div>
  );
}

export default App;
