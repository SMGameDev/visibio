import Game from './game.js';
import $ from 'jquery';

$(
  () => {
    // dev code; remove in production
    sessionStorage.username = 'bob';
    // create game
    let game = new Game(sessionStorage.username);
  }
)
