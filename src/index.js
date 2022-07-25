import React, { useState } from "react";
import ReactDOM from "./dom/ReactDom";
// import ReactDOM from "react-dom";

function App() {
  const [num, setNum] = useState(1);

  const [operator, setOperator] = useState("+");

  return (
    <div key={"div"}>
      <p>{num}</p>
      <button
        onClick={() => {
          setOperator("+");
        }}
      >
        ++
      </button>
      <button
        onClick={() => {
          setOperator("-");
        }}
      >
        --
      </button>
      <button
        onClick={() => {
          setNum(eval(`${num}${operator}1`));
        }}
      >
        提交
      </button>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));

// const root = createRoot(document.getElementById("root"));
// root.render(<App />);
