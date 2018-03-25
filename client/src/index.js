import Client from './client.js'

let client = new Client({});

client.on('connected', () => console.log('connected'));
client.on('spawned', () => console.log('world ', client.world));
client.on('perception', () => console.log('perception ', client.entities));
client.on('disconnected', () => console.log('disconnected'));
client.connect()
  .then(() => {
    console.log("connected; spawning...");
    return client.respawn('meyer')
  })
  .catch((e) => console.log(e));