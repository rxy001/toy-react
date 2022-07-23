import React, { useState } from "react";
// import ReactDOM from "./dom/ReactDom";
import ReactDOM from "react-dom";

function App() {
  const [num, setNum] = useState(1);

  return (
    <div key={"div"}>
      <p>{num}</p>
      <button
        onClick={() => {
          debugger;
          setNum((num) => num + 1);
        }}
      >
        ++
      </button>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));

// const root = createRoot(document.getElementById("root"));
// root.render(<App />);
