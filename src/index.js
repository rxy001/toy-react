import React, { useEffect, useLayoutEffect, useState } from "react";
import ReactDOM from "./dom/ReactDom";
// import ReactDOM from "react-dom";
// import ReactDOM from "react-dom/client";

function App() {
  const [num, setNum] = useState(1);

  const [operator, setOperator] = useState("+");

  // useLayoutEffect(() => {
  //   console.log(" app.layout");
  // });

  useEffect(() => {
    setNum((v) => v + 3);
  }, []);

  return (
    <div key={"div"}>
      <p>{num}</p>
      {/* <button
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
          setNum((v) => eval(`${v}${operator}1`));
          setNum((v) => eval(`${v}${operator}1`));
        }}
      >
        提交
      </button>
      {num !== 1 ? null : <Child />} */}
    </div>
  );
}

function Child() {
  useLayoutEffect(() => {
    debugger;
    console.log(" child.layout");

    return () => console.log("destory child.layout");
  });

  useEffect(() => {
    console.log("child effect");
    return () => console.log("destory child.effect");
  });

  return <div>Child</div>;
}

ReactDOM.render(<App />, document.getElementById("root"));

// function App1() {
//   return (
//     <div>
//       {new Array(10000).fill(1).map((v, i) => (
//         <div>{i}</div>
//       ))}
//     </div>
//   );
// }
// const root = ReactDOM.createRoot(document.getElementById("root"));
// root.render(<App1 />);
