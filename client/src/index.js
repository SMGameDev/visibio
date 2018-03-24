import Client from './client.js'
import $ from 'jquery'

let client = new Client({});

$(window).ready(() => {
  client.connect()
    .then(() => {
      console.log("connected; spawning...");
      return client.respawn('meyer')
    })
    .then((states) => {
      console.log("spawned");
      console.log("world: ", states.next());
      for (state of states.next()) {
        if (state.done) {
          console.log("time alive: ", state);
          break;
        } else {
          console.log("perception: ", state)
        }
      }
    })
    .catch((e) => console.log(e));
});