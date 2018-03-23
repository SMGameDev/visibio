import Client from './client.js'
import $ from 'jquery'

let client = new Client({});
client.connect()
  .then(() => {
    return client.respawn('meyer')
  })
  .then((world) => {
    console.log(world);
    for (state of client.getStates()) {
      console.log(state)
    }
  })
  .catch((e) => console.log(e));

$(window).ready(() => {
});