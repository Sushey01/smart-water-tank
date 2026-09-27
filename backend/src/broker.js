import net from "net";
import { Aedes } from "aedes";

export async function startBroker(port = 1883) {
  const broker = await Aedes.createBroker();
  const server = net.createServer(broker.handle);
  return new Promise((resolve, reject) => {
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.log("MQTT port 1883 is already open; using that broker");
        resolve(false);
        return;
      }
      reject(error);
    });
    server.listen(port, "127.0.0.1", () => {
      console.log(`MQTT broker listening on 127.0.0.1:${port}`);
      resolve(true);
    });
  });
}
