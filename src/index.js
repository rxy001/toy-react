import React, { useState } from "react";
import ReactDOM from "./dom/ReactDom";
// import ReactDOM from "react-dom";

// function App() {
//   // const [e, setE] = useState("123123123");
//   return (
//     <div>
//       <div style={{ width: 200, height: 200, background: "green" }}>
//         {123123}
//       </div>
//     </div>
//   );
// }

ReactDOM.render(
  <div
    onClick={() => {
      console.log("123");
    }}
  >
    <div style={{ height: 200, width: 200, background: "green" }}>123123</div>
  </div>,
  document.getElementById("root")
);
// const root = createRoot(document.getElementById("root"));
// root.render(<App />);
