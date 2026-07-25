import { useEffect } from "react";
import api from "./services/api";

function App() {
  useEffect(() => {
    async function test() {
      try {
        const res = await api.get("/");
        console.log(res.data);
      } catch (err) {
        console.error(err);
      }
    }

    test();
  }, []);

  return (
    <h1>ResQPilot</h1>
  );
}

export default App;